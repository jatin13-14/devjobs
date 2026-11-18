from django.db import migrations, models
from django.db.models import F, Value
from django.db.models.functions import Lower, Replace


SKILL_NAME_CANONICAL_PATTERN = r"^[^ ]+( [^ ]+)*$"
SKILL_NON_ASCII_WHITESPACE = tuple(
    character
    for codepoint in range(0x3001)
    if (character := chr(codepoint)).isspace() and character != " "
)


def skill_without_non_ascii_whitespace():
    expression = F("name")
    for character in SKILL_NON_ASCII_WHITESPACE:
        expression = Replace(expression, Value(character), Value(""))
    return expression


def reject_noncanonical_skills(apps, schema_editor):
    Skill = apps.get_model("candidates", "Skill")
    database = schema_editor.connection.alias
    invalid_count = sum(
        name != " ".join(name.split()).lower()
        for name in Skill.objects.using(database).values_list("name", flat=True).iterator()
    )
    if invalid_count:
        raise RuntimeError(
            f"Cannot enforce exact skill whitespace rules: {invalid_count} existing skill rows "
            "are noncanonical. Resolve them explicitly before applying this migration."
        )


class Migration(migrations.Migration):
    dependencies = [("candidates", "0009_explicit_skill_whitespace_constraint")]

    operations = [
        migrations.RunPython(reject_noncanonical_skills, migrations.RunPython.noop),
        migrations.RemoveConstraint(
            model_name="skill", name="candidates_skill_name_canonical"
        ),
        migrations.AddConstraint(
            model_name="skill",
            constraint=models.CheckConstraint(
                condition=models.Q(name=Lower("name"))
                & models.Q(name__regex=SKILL_NAME_CANONICAL_PATTERN)
                & models.Q(name=skill_without_non_ascii_whitespace()),
                name="candidates_skill_name_canonical",
            ),
        ),
    ]
