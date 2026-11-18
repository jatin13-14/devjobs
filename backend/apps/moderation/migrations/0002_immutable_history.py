from django.db import migrations

SQL = """
CREATE FUNCTION moderation_history_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Moderation history is append-only'; END; $$;
CREATE TRIGGER moderation_history_immutable BEFORE UPDATE OR DELETE ON moderation_moderationevent
FOR EACH ROW EXECUTE FUNCTION moderation_history_immutable();
"""


class Migration(migrations.Migration):
    dependencies = [('moderation', '0001_initial')]
    operations = [migrations.RunSQL(SQL, 'DROP TRIGGER moderation_history_immutable ON moderation_moderationevent; DROP FUNCTION moderation_history_immutable();')]
