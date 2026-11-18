"""Pure identity policy for the legacy PostgreSQL test endpoint."""

def is_expected_database_identity(database, port, version, test_name="test_devjobs_test"):
    """Validate server identity independently of connection URL validation above."""
    return (
        database == "devjobs_test"
        and port == 5433
        and version.split()[0] == "17.5"
        and test_name == "test_devjobs_test"
    )
