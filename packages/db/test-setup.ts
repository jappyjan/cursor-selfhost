/**
 * Must run before any imports that load the db client.
 * Uses in-memory SQLite so tests never touch dev/prod database files.
 */
process.env.DATABASE_PATH = ":memory:";
