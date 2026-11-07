from django.db import migrations, models


SKILL_NAME_CANONICAL_PATTERN = (
    r"^[^\u0009-\u000D\u001C-\u001F\u0085\u00A0\u1680\u2000-\u200A"
    r"\u2028\u2029\u202F\u205F\u3000]+( [^\u0009-\u000D\u001C-\u001F"
    r"\u0085\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]+)*$"
)


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
    dependencies = [("candidates", "0008_fail_closed_profile_role_guard")]

    operations = [
        migrations.RunPython(reject_noncanonical_skills, migrations.RunPython.noop),
        migrations.RemoveConstraint(
            model_name="skill", name="candidates_skill_name_canonical"
        ),
        migrations.AddConstraint(
            model_name="skill",
            constraint=models.CheckConstraint(
                condition=models.Q(name=models.functions.Lower("name"))
                & models.Q(name__regex=SKILL_NAME_CANONICAL_PATTERN),
                name="candidates_skill_name_canonical",
            ),
        ),
    ]
