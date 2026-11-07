from django.db import migrations


FORWARD = """
DROP TRIGGER IF EXISTS accounts_user_profile_role_guard ON accounts_user;
CREATE CONSTRAINT TRIGGER accounts_user_profile_role_guard
AFTER INSERT OR UPDATE OF role ON accounts_user
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION accounts_profile_role_guard();
"""

REVERSE = """
DROP TRIGGER IF EXISTS accounts_user_profile_role_guard ON accounts_user;
CREATE CONSTRAINT TRIGGER accounts_user_profile_role_guard
AFTER INSERT OR UPDATE ON accounts_user
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION accounts_profile_role_guard();
"""


def scope_trigger(apps, schema_editor):
    if schema_editor.connection.vendor == "postgresql":
        schema_editor.execute(FORWARD)


def restore_trigger(apps, schema_editor):
    if schema_editor.connection.vendor == "postgresql":
        schema_editor.execute(REVERSE)


class Migration(migrations.Migration):
    dependencies = [
        ("candidates", "0005_profile_role_compatibility_triggers"),
        ("companies", "0007_serialize_deferred_integrity_checks"),
    ]
    operations = [migrations.RunPython(scope_trigger, restore_trigger)]
