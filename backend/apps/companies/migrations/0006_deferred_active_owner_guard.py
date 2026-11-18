from django.db import migrations


FORWARD = """
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM companies_company c
        WHERE NOT EXISTS (
            SELECT 1 FROM companies_companymembership m
            WHERE m.company_id = c.id AND m.role = 'OWNER' AND m.status = 'ACTIVE'
        )
    ) THEN
        RAISE EXCEPTION 'Existing companies without an active owner must be reviewed before migration';
    END IF;
END;
$$;

CREATE FUNCTION companies_require_active_owner(company_uuid uuid) RETURNS void AS $$
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

CREATE FUNCTION companies_membership_owner_guard() RETURNS trigger AS $$
BEGIN
    IF TG_OP <> 'INSERT' THEN PERFORM companies_require_active_owner(OLD.company_id); END IF;
    IF TG_OP <> 'DELETE' THEN PERFORM companies_require_active_owner(NEW.company_id); END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER companies_membership_owner_guard
AFTER INSERT OR UPDATE OR DELETE ON companies_companymembership
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
EXECUTE FUNCTION companies_membership_owner_guard();

CREATE FUNCTION companies_new_company_owner_guard() RETURNS trigger AS $$
BEGIN
    PERFORM companies_require_active_owner(NEW.id);
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER companies_new_company_owner_guard
AFTER INSERT ON companies_company
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
EXECUTE FUNCTION companies_new_company_owner_guard();
"""

REVERSE = """
DROP TRIGGER IF EXISTS companies_new_company_owner_guard ON companies_company;
DROP FUNCTION IF EXISTS companies_new_company_owner_guard();
DROP TRIGGER IF EXISTS companies_membership_owner_guard ON companies_companymembership;
DROP FUNCTION IF EXISTS companies_membership_owner_guard();
DROP FUNCTION IF EXISTS companies_require_active_owner(uuid);
"""


def install_guards(apps, schema_editor):
    if schema_editor.connection.vendor == "postgresql":
        schema_editor.execute(FORWARD)


def remove_guards(apps, schema_editor):
    if schema_editor.connection.vendor == "postgresql":
        schema_editor.execute(REVERSE)


class Migration(migrations.Migration):
    dependencies = [("companies", "0005_remove_company_companies_hq_country_alpha2_and_more")]
    operations = [migrations.RunPython(install_guards, remove_guards)]
