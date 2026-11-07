from django.db import migrations


FORWARD = """
CREATE FUNCTION accounts_profile_role_guard() RETURNS trigger AS $$
DECLARE
    account_uuid uuid;
    account_role varchar(20);
BEGIN
    IF TG_TABLE_NAME = 'accounts_user' THEN
        account_uuid := COALESCE(NEW.id, OLD.id);
    ELSIF TG_TABLE_NAME = 'candidates_candidateprofile' THEN
        account_uuid := COALESCE(NEW.user_id, OLD.user_id);
    ELSE
        account_uuid := COALESCE(NEW.user_id, OLD.user_id);
    END IF;
    SELECT role INTO account_role FROM accounts_user WHERE id = account_uuid FOR UPDATE;
    IF account_role IS NOT NULL AND (
        (account_role = 'candidate' AND EXISTS (SELECT 1 FROM recruiters_recruiterprofile WHERE user_id = account_uuid)) OR
        (account_role = 'recruiter' AND EXISTS (SELECT 1 FROM candidates_candidateprofile WHERE user_id = account_uuid)) OR
        (account_role = 'admin' AND (EXISTS (SELECT 1 FROM recruiters_recruiterprofile WHERE user_id = account_uuid)
                                     OR EXISTS (SELECT 1 FROM candidates_candidateprofile WHERE user_id = account_uuid)))
    ) THEN
        RAISE EXCEPTION 'User role conflicts with attached profile' USING ERRCODE = '23514';
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER accounts_user_profile_role_guard
AFTER INSERT OR UPDATE ON accounts_user
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION accounts_profile_role_guard();
CREATE CONSTRAINT TRIGGER candidates_profile_role_guard
AFTER INSERT OR UPDATE OR DELETE ON candidates_candidateprofile
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION accounts_profile_role_guard();
CREATE CONSTRAINT TRIGGER recruiters_profile_role_guard
AFTER INSERT OR UPDATE OR DELETE ON recruiters_recruiterprofile
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION accounts_profile_role_guard();
"""

REVERSE = """
DROP TRIGGER IF EXISTS recruiters_profile_role_guard ON recruiters_recruiterprofile;
DROP TRIGGER IF EXISTS candidates_profile_role_guard ON candidates_candidateprofile;
DROP TRIGGER IF EXISTS accounts_user_profile_role_guard ON accounts_user;
DROP FUNCTION IF EXISTS accounts_profile_role_guard();
"""


def install_guards(apps, schema_editor):
    if schema_editor.connection.vendor == "postgresql":
        schema_editor.execute(FORWARD)


def remove_guards(apps, schema_editor):
    if schema_editor.connection.vendor == "postgresql":
        schema_editor.execute(REVERSE)


class Migration(migrations.Migration):
    dependencies = [
        ("candidates", "0004_remove_candidateprofile_candidates_profile_country_alpha2_and_more"),
        ("recruiters", "0001_initial"),
    ]
    operations = [migrations.RunPython(install_guards, remove_guards)]
