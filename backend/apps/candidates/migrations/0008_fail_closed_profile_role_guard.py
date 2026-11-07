from django.db import migrations


FORWARD = """
CREATE OR REPLACE FUNCTION accounts_profile_role_guard() RETURNS trigger AS $$
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
    IF account_role IS NOT NULL AND account_role NOT IN ('candidate', 'recruiter', 'admin') THEN
        RAISE EXCEPTION 'Unsupported user role' USING ERRCODE = '23514';
    END IF;
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
"""


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0004_supported_role_constraint"),
        ("candidates", "0007_strict_skill_name_canonical"),
        ("recruiters", "0001_initial"),
    ]
    operations = [
        migrations.RunSQL(
            FORWARD,
            reverse_sql=migrations.RunSQL.noop,
        )
    ]
