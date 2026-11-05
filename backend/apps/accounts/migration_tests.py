from django.db import IntegrityError, connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TransactionTestCase


class CanonicalEmailConstraintMigrationTests(TransactionTestCase):
    migrate_from = ("accounts", "0002_normalize_existing_emails")
    migrate_to = ("accounts", "0003_canonical_email_constraint")

    def setUp(self):
        super().setUp()
        MigrationExecutor(connection).migrate([self.migrate_from])
        self.executor = MigrationExecutor(connection)
        self.User = self.executor.loader.project_state([self.migrate_from]).apps.get_model(
            "accounts", "User"
        )

    def tearDown(self):
        historical_user = (
            MigrationExecutor(connection)
            .loader.project_state([self.migrate_from])
            .apps.get_model("accounts", "User")
        )
        historical_user.objects.all().delete()
        MigrationExecutor(connection).migrate(
            MigrationExecutor(connection).loader.graph.leaf_nodes()
        )
        super().tearDown()

    def make_user(self, email, **fields):
        return self.User.objects.create(
            email=email,
            password="hashed-password-placeholder",
            first_name=fields.get("first_name", "Original"),
            last_name=fields.get("last_name", "Candidate"),
            role=fields.get("role", "candidate"),
        )

    def assert_preflight_rejects_without_mutation(self, emails):
        users = [
            self.make_user(email, first_name=f"Account {index}")
            for index, email in enumerate(emails)
        ]
        before = list(
            self.User.objects.order_by("id").values_list(
                "id", "email", "password", "first_name", "last_name", "role", "is_active"
            )
        )
        with self.assertRaisesRegex(RuntimeError, "ASCII email identity|duplicate accounts"):
            MigrationExecutor(connection).migrate([self.migrate_to])
        after = list(
            self.User.objects.order_by("id").values_list(
                "id", "email", "password", "first_name", "last_name", "role", "is_active"
            )
        )
        self.assertEqual(after, before)
        self.assertEqual(len(users), len(before))
        self.assertNotIn(
            ("accounts", "0003_canonical_email_constraint"),
            set(MigrationExecutor(connection).recorder.applied_migrations()),
        )

    def test_preflight_rejects_mixed_case_duplicates_without_changing_accounts(self):
        self.assert_preflight_rejects_without_mutation(["Case@example.com", "case@EXAMPLE.COM"])

    def test_preflight_rejects_whitespace_normalized_duplicates_without_mutation(self):
        self.assert_preflight_rejects_without_mutation(
            ["\tpadded@example.com\n", "padded@example.com"]
        )

    def test_preflight_rejects_other_ascii_whitespace_duplicates_without_mutation(self):
        self.assert_preflight_rejects_without_mutation(
            ["\fpadded@example.com\v", "padded@example.com"]
        )

    def test_preflight_rejects_unicode_email_without_changing_account_data(self):
        self.assert_preflight_rejects_without_mutation(["İ@example.com"])

    def test_preflight_rejects_unicode_casefold_equivalence_without_mutation(self):
        self.assert_preflight_rejects_without_mutation(
            ["Straße@example.com", "strasse@example.com"]
        )

    def test_constraints_are_created_and_enforce_identity_rules(self):
        self.make_user("normal@example.com")
        MigrationExecutor(connection).migrate([self.migrate_to])
        constraints = connection.introspection.get_constraints(
            connection.cursor(), self.User._meta.db_table
        )
        self.assertIn("accounts_user_email_ascii", constraints)
        self.assertIn("accounts_user_email_canonical", constraints)
        self.assertIn("accounts_user_email_canonical_uniq", constraints)

        with self.assertRaises(IntegrityError), connection.cursor() as cursor:
            cursor.execute(
                f'INSERT INTO "{self.User._meta.db_table}" '
                '("password", "email", "first_name", "last_name", "role", '
                '"is_active", "is_staff", "is_superuser", "date_joined", "id") '
                "VALUES ('x', 'ü@example.com', '', '', 'candidate', true, false, false, "
                "CURRENT_TIMESTAMP, '00000000-0000-0000-0000-000000000001')"
            )

        with self.assertRaises(IntegrityError), connection.cursor() as cursor:
            cursor.execute(
                f'INSERT INTO "{self.User._meta.db_table}" '
                '("password", "email", "first_name", "last_name", "role", '
                '"is_active", "is_staff", "is_superuser", "date_joined", "id") '
                "VALUES ('x', ' NORMAL@example.com ', '', '', 'candidate', true, false, false, "
                "CURRENT_TIMESTAMP, '00000000-0000-0000-0000-000000000002')"
            )

        for email, user_id in (
            ("\tnormal@example.com", "00000000-0000-0000-0000-000000000003"),
            ("normal@example.com\n", "00000000-0000-0000-0000-000000000004"),
        ):
            with (
                self.subTest(email=repr(email)),
                self.assertRaises(IntegrityError),
                connection.cursor() as cursor,
            ):
                cursor.execute(
                    f'INSERT INTO "{self.User._meta.db_table}" '
                    '("password", "email", "first_name", "last_name", "role", '
                    '"is_active", "is_staff", "is_superuser", "date_joined", "id") '
                    "VALUES ('x', %s, '', '', 'candidate', true, false, false, "
                    "CURRENT_TIMESTAMP, %s)",
                    [email, user_id],
                )

    def test_reverse_migration_removes_canonical_constraints(self):
        self.make_user("reverse@example.com")
        MigrationExecutor(connection).migrate([self.migrate_to])
        MigrationExecutor(connection).migrate([self.migrate_from])
        constraints = connection.introspection.get_constraints(
            connection.cursor(), self.User._meta.db_table
        )
        self.assertNotIn("accounts_user_email_ascii", constraints)
        self.assertNotIn("accounts_user_email_canonical", constraints)
        self.assertNotIn("accounts_user_email_canonical_uniq", constraints)
        self.make_user("REVERSE@example.com")
