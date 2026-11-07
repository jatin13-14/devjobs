from django.db import migrations, models


def reject_noncanonical_skills(apps, schema_editor):
    Skill = apps.get_model("candidates", "Skill")
    database = schema_editor.connection.alias
    invalid_count = sum(
        name != " ".join(name.split()).lower()
        for name in Skill.objects.using(database).values_list("name", flat=True).iterator()
    )
    if invalid_count:
        raise RuntimeError(
            f"Cannot enforce canonical skill names: {invalid_count} existing skill rows "
            "are noncanonical. Resolve them explicitly before applying this migration."
        )


class Migration(migrations.Migration):
    dependencies = [("candidates", "0006_scope_role_trigger_to_role_changes")]

    operations = [
        migrations.RunPython(reject_noncanonical_skills, migrations.RunPython.noop),
        migrations.RemoveConstraint(
            model_name="skill", name="candidates_skill_name_canonical"
        ),
        migrations.AddConstraint(
            model_name="skill",
            constraint=models.CheckConstraint(
                condition=models.Q(name=models.functions.Lower("name"))
                & models.Q(name__regex=r"^[^[:space:]]+( [^[:space:]]+)*$"),
                name="candidates_skill_name_canonical",
            ),
        ),
    ]
