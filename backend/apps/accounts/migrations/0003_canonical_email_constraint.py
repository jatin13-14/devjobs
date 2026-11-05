from typing import ClassVar

from django.db import migrations, models
from django.db.models import Value
from django.db.models.functions import Lower

from apps.accounts.models import EmailTrim

EMAIL_SURROUNDING_WHITESPACE = " \t\n\r\f\v"


def canonical_email_expression():
    return Lower(EmailTrim("email", Value(EMAIL_SURROUNDING_WHITESPACE)))


def reject_canonical_email_duplicates(apps, schema_editor):
    User = apps.get_model("accounts", "User")
    database = schema_editor.connection.alias
    seen = set()
    duplicates = set()
    for email in User.objects.using(database).values_list("email", flat=True).iterator():
        if not email.isascii():
            raise RuntimeError(
                "ASCII email identity cannot be enforced while non-ASCII account emails exist. "
                "Resolve the accounts manually before applying this migration."
            )
        canonical = email.strip(EMAIL_SURROUNDING_WHITESPACE).lower()
        if canonical in seen:
            duplicates.add(canonical)
        seen.add(canonical)
    if duplicates:
        raise RuntimeError(
            "Canonical email uniqueness cannot be added while duplicate accounts exist. "
            "Resolve the accounts manually before applying this migration."
        )


class Migration(migrations.Migration):
    dependencies = (("accounts", "0002_normalize_existing_emails"),)

    operations: ClassVar[list] = [
        migrations.RunPython(reject_canonical_email_duplicates, migrations.RunPython.noop),
        migrations.AddConstraint(
            model_name="user",
            constraint=models.CheckConstraint(
                condition=models.Q(email__regex=r"^[\x01-\x7F]+$"),
                name="accounts_user_email_ascii",
            ),
        ),
        migrations.AddConstraint(
            model_name="user",
            constraint=models.CheckConstraint(
                condition=models.Q(email=canonical_email_expression()),
                name="accounts_user_email_canonical",
            ),
        ),
        migrations.AddConstraint(
            model_name="user",
            constraint=models.UniqueConstraint(
                canonical_email_expression(), name="accounts_user_email_canonical_uniq"
            ),
        ),
    ]
