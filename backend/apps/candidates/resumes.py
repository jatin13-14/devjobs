"""Private resume storage and transaction-bound mutations; never serialize storage keys."""

import io
import logging
import re
import uuid

from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import FileSystemStorage
from django.db import transaction
from django.http import FileResponse
from django.shortcuts import get_object_or_404
from django.utils.module_loading import import_string
from pypdf import PdfReader
from rest_framework import serializers
from rest_framework.exceptions import NotFound

from .models import CandidateProfile, CandidateResume

logger = logging.getLogger(__name__)
KEY_PATTERN = re.compile(r"^[0-9a-f]{32}\.pdf$")


def storage():
    if settings.PRIVATE_RESUME_STORAGE_BACKEND:
        return import_string(settings.PRIVATE_RESUME_STORAGE_BACKEND)()
    return FileSystemStorage(
        location=settings.PRIVATE_RESUME_ROOT,
        base_url=None,
        file_permissions_mode=0o600,
        directory_permissions_mode=0o700,
    )


def validate_pdf(upload):
    if upload.size > settings.RESUME_MAX_BYTES:
        raise serializers.ValidationError({"file": "Resume exceeds the upload size limit."})
    data = upload.read(settings.RESUME_MAX_BYTES + 1)
    if len(data) > settings.RESUME_MAX_BYTES:
        raise serializers.ValidationError({"file": "Resume exceeds the upload size limit."})
    try:
        if not data.startswith(b"%PDF-") or not data.rstrip().endswith(b"%%EOF"):
            raise ValueError
        reader = PdfReader(io.BytesIO(data), strict=True)
        if reader.is_encrypted or not len(reader.pages):
            raise ValueError
        # Resolve every page's dictionary. Never render, extract text, or decompress streams.
        for page in reader.pages:
            if page.get("/Type") != "/Page" or len(page.mediabox) != 4:
                raise ValueError
    except Exception as exc:
        raise serializers.ValidationError(
            {"file": "Upload a valid, unencrypted PDF with pages."}
        ) from exc
    return data


def cleanup(key):
    if not KEY_PATTERN.fullmatch(key):
        return
    try:
        storage().delete(key)
    except OSError:
        # Do not include exception text, keys, filenames or absolute paths in logs.
        logger.warning("Private resume cleanup failed; run orphan reconciliation.")


def replace_resume(candidate, data):
    key = None
    try:
        # Durable boundary prevents a successful write followed by an outer rollback.
        with transaction.atomic(durable=True):
            CandidateProfile.objects.select_for_update().get(pk=candidate.pk)
            previous = CandidateResume.objects.filter(candidate=candidate).first()
            key = storage().save(f"{uuid.uuid4().hex}.pdf", ContentFile(data))
            resume, _ = CandidateResume.objects.update_or_create(
                candidate=candidate, defaults={"storage_key": key, "size": len(data)}
            )
            if previous:
                transaction.on_commit(lambda: cleanup(previous.storage_key), robust=True)
        return resume
    except Exception:
        if key:
            cleanup(key)
        raise


def remove_resume(candidate):
    with transaction.atomic(durable=True):
        CandidateProfile.objects.select_for_update().get(pk=candidate.pk)
        resume = CandidateResume.objects.filter(candidate=candidate).first()
        if resume:
            key = resume.storage_key
            resume.delete()
            transaction.on_commit(lambda: cleanup(key), robust=True)


def metadata(resume):
    return {
        "filename": "resume.pdf",
        "content_type": "application/pdf",
        "size": resume.size,
        "updated_at": resume.updated_at,
    }


def download(candidate):
    resume = get_object_or_404(CandidateResume, candidate=candidate)
    if not KEY_PATTERN.fullmatch(resume.storage_key):
        raise NotFound("Resume unavailable.")
    try:
        handle = storage().open(resume.storage_key, "rb")
    except (OSError, ValueError):
        raise NotFound("Resume unavailable.") from None
    response = FileResponse(
        handle, as_attachment=True, filename="resume.pdf", content_type="application/pdf"
    )
    response["Cache-Control"] = "private, no-store"
    response["X-Content-Type-Options"] = "nosniff"
    response["Content-Security-Policy"] = "sandbox; default-src 'none'"
    return response
