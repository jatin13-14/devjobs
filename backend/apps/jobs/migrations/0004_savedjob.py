# Generated for P1-01 Saved Jobs

import django.db.models.deletion
import uuid
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("candidates", "0011_candidateresume"),
        ("jobs", "0003_job_cursor_created_index"),
    ]

    operations = [
        migrations.CreateModel(
            name="SavedJob",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("saved_at", models.DateTimeField(auto_now_add=True)),
                (
                    "candidate",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="saved_jobs",
                        to="candidates.candidateprofile",
                    ),
                ),
                (
                    "job",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="saved_by",
                        to="jobs.job",
                    ),
                ),
            ],
            options={"ordering": ("-saved_at", "-id")},
        ),
        migrations.AddConstraint(
            model_name="savedjob",
            constraint=models.UniqueConstraint(
                fields=("candidate", "job"), name="jobs_saved_candidate_job_unique"
            ),
        ),
        migrations.AddIndex(
            model_name="savedjob",
            index=models.Index(
                fields=("candidate", "-saved_at"), name="jobs_saved_candidate_date_idx"
            ),
        ),
    ]
