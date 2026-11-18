from django.db import migrations, models


SUPPORTED_ROLES = ("candidate", "recruiter", "admin")


def reject_unknown_roles(apps, schema_editor):
    User = apps.get_model("accounts", "User")
    invalid_count = User.objects.using(schema_editor.connection.alias).exclude(
        role__in=SUPPORTED_ROLES
    ).count()
    if invalid_count:
        raise RuntimeError(
            f"Cannot enforce supported account roles: {invalid_count} existing accounts "
            "have unknown roles. Resolve them explicitly before applying this migration."
        )


class Migration(migrations.Migration):
    dependencies = [("accounts", "0003_canonical_email_constraint")]

    operations = [
        migrations.RunPython(reject_unknown_roles, migrations.RunPython.noop),
        migrations.AddConstraint(
            model_name="user",
            constraint=models.CheckConstraint(
                condition=models.Q(role__in=SUPPORTED_ROLES),
                name="accounts_user_role_supported",
            ),
        ),
    ]
