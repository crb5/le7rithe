// One-time data migration: copy every PostgreSQL table into a MongoDB
// collection of the same name (with the `marketplace_` prefix stripped).
//
// This is a faithful row->document copy. It does NOT reshape the data; the
// application's eventual MongoDB layer can decide final collection names and
// embedding. Numeric ids and foreign-key columns are preserved as-is.
//
// Usage:
//   SOURCE_DATABASE_URL="postgres://user:pass@host:5432/le7rithe_dev" \
//   MONGODB_URL="mongodb+srv://.../le7rithe" \
//   node scripts/src/pg-to-mongo.mjs            # add --wipe to clear collections first
//
// If you only have the .dump file, restore it into a Postgres database first:
//   createdb le7rithe_restore
//   pg_restore --no-owner --no-privileges -d le7rithe_restore le7rithe-development-*.dump
// then point SOURCE_DATABASE_URL at le7rithe_restore.

import pg from "pg";
import { MongoClient } from "mongodb";

const PG_URL = process.env.SOURCE_DATABASE_URL || process.env.DATABASE_URL;
const MONGO_URL = process.env.MONGODB_URL;
const WIPE = process.argv.includes("--wipe");
const STRIP_PREFIX = /^marketplace_/;

function fail(message) {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}

if (!PG_URL) fail("SOURCE_DATABASE_URL (or DATABASE_URL) is required — the source Postgres.");
if (!MONGO_URL) fail("MONGODB_URL is required — the target MongoDB cluster (include the db name, e.g. .../le7rithe).");

// Keep Postgres numeric/bigint as JS numbers where safe so Mongo stores numbers,
// not strings. (node-postgres returns numeric/bigint as strings by default.)
pg.types.setTypeParser(1700, (v) => (v === null ? null : Number(v))); // numeric
pg.types.setTypeParser(20, (v) => (v === null ? null : Number(v)));   // int8/bigint

async function main() {
  const pgClient = new pg.Client({
    connectionString: PG_URL,
    // Managed Postgres (and most cloud providers) require TLS.
    ssl: /localhost|127\.0\.0\.1/.test(PG_URL) ? false : { rejectUnauthorized: false },
  });
  await pgClient.connect();

  const mongo = new MongoClient(MONGO_URL);
  await mongo.connect();
  const mongoDb = mongo.db(); // database name comes from the connection string

  const { rows: tables } = await pgClient.query(
    `select tablename from pg_tables where schemaname = 'public' order by tablename`,
  );
  if (tables.length === 0) fail("No tables found in the source Postgres 'public' schema.");

  let totalDocs = 0;
  for (const { tablename } of tables) {
    const collectionName = tablename.replace(STRIP_PREFIX, "");
    const collection = mongoDb.collection(collectionName);

    if (WIPE) await collection.deleteMany({});

    const { rows } = await pgClient.query(`select * from "${tablename}"`);
    if (rows.length > 0) {
      // Insert in batches to stay well under the 16MB BSON command limit.
      const batchSize = 1000;
      for (let i = 0; i < rows.length; i += batchSize) {
        await collection.insertMany(rows.slice(i, i + batchSize), { ordered: false });
      }
    }
    totalDocs += rows.length;
    console.log(`${tablename.padEnd(42)} -> ${collectionName.padEnd(30)} ${rows.length} docs`);
  }

  console.log(`\n✔ Done. Copied ${tables.length} tables / ${totalDocs} documents into MongoDB.`);
  await pgClient.end();
  await mongo.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
