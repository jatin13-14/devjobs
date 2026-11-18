from django.db import migrations


FORWARD = """
CREATE OR REPLACE FUNCTION companies_require_active_owner(company_uuid uuid) RETURNS void AS $$
BEGIN
    PERFORM 1 FROM companies_company WHERE id = company_uuid FOR UPDATE;
    IF FOUND AND NOT EXISTS (
        SELECT 1 FROM companies_companymembership
        WHERE company_id = company_uuid AND role = 'OWNER' AND status = 'ACTIVE'
    ) THEN
        RAISE EXCEPTION 'Company %% must have an active owner at transaction commit', company_uuid
            USING ERRCODE = '23514', CONSTRAINT = 'companies_require_active_owner';
    END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION accounts_profile_role_guard() RETURNS trigger AS $$
DECLARE
    account_uuid uuid;
    account_role varchar(20);
BEGIN
    IF TG_TABLE_NAME = 'accounts_user' THEN
        account_uuid := COALESCE(NEW.id, OLD.id);
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
"""

REVERSE = """
CREATE OR REPLACE FUNCTION companies_require_active_owner(company_uuid uuid) RETURNS void AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM companies_company WHERE id = company_uuid)
       AND NOT EXISTS (
           SELECT 1 FROM companies_companymembership
           WHERE company_id = company_uuid AND role = 'OWNER' AND status = 'ACTIVE'
       ) THEN
        RAISE EXCEPTION 'Company %% must have an active owner at transaction commit', company_uuid
            USING ERRCODE = '23514', CONSTRAINT = 'companies_require_active_owner';
    END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION accounts_profile_role_guard() RETURNS trigger AS $$
DECLARE
    account_uuid uuid;
    account_role varchar(20);
BEGIN
    IF TG_TABLE_NAME = 'accounts_user' THEN
        account_uuid := COALESCE(NEW.id, OLD.id);
        SELECT role INTO account_role FROM accounts_user WHERE id = account_uuid;
    ELSIF TG_TABLE_NAME = 'candidates_candidateprofile' THEN
        account_uuid := COALESCE(NEW.user_id, OLD.user_id);
        SELECT role INTO account_role FROM accounts_user WHERE id = account_uuid;
    ELSE
        account_uuid := COALESCE(NEW.user_id, OLD.user_id);
        SELECT role INTO account_role FROM accounts_user WHERE id = account_uuid;
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


def update_functions(apps, schema_editor):
    if schema_editor.connection.vendor == "postgresql":
        schema_editor.execute(FORWARD)


def restore_functions(apps, schema_editor):
    if schema_editor.connection.vendor == "postgresql":
        schema_editor.execute(REVERSE)


class Migration(migrations.Migration):
    dependencies = [
        ("companies", "0006_deferred_active_owner_guard"),
        ("candidates", "0005_profile_role_compatibility_triggers"),
    ]
    operations = [migrations.RunPython(update_functions, restore_functions)]
