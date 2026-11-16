from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("jobs", "0002_job_is_hidden")]

    operations = [
        migrations.AddIndex(
            model_name="job",
            index=models.Index(fields=["-created_at", "-id"], name="jobs_cursor_created_idx"),
        ),
    ]
