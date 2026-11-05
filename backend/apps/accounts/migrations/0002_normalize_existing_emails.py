from django.db import migrations


def normalize_existing_emails(apps, schema_editor):
    User = apps.get_model("accounts", "User")
    database = schema_editor.connection.alias
    seen = set()
    updates = []
    for user in User.objects.using(database).all().only("id", "email").iterator():
        normalized = user.email.strip().casefold()
        if normalized in seen:
            raise RuntimeError(
                "Email normalization found case-insensitive duplicate accounts. "
                "Resolve duplicate accounts before applying this migration."
            )
        seen.add(normalized)
        if normalized != user.email:
            user.email = normalized
            updates.append(user)
    if updates:
        User.objects.using(database).bulk_update(updates, ["email"])


class Migration(migrations.Migration):
    dependencies = [("accounts", "0001_initial")]

    operations = [migrations.RunPython(normalize_existing_emails, migrations.RunPython.noop)]
