/**
 * Must run before any imports that load @cursor-selfhost/db
 */
process.env.DATABASE_PATH = ":memory:";
