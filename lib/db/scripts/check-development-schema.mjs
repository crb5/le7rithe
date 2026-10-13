import pg from "pg";
import { getTableConfig } from "drizzle-orm/pg-core";
import * as schema from "../src/schema/marketplace.ts";
import * as rateLimitSchema from "../src/schema/rate-limits.ts";

const { Client } = pg;
const tableNameSymbol = Symbol.for("drizzle:Name");
const columnsSymbol = Symbol.for("drizzle:Columns");
const highRiskTableNames = new Set([
  "marketplace_reports",
  "marketplace_notifications",
  "marketplace_payments",
  "marketplace_api_rate_limits",
]);
const expectedTables = Object.values({ ...schema, ...rateLimitSchema })
  .filter(
    (value) =>
      value &&
      typeof value === "object" &&
      typeof value[tableNameSymbol] === "string" &&
      value[columnsSymbol],
  )
  .map((table) => ({
    name: table[tableNameSymbol],
    table,
    columns: Object.values(table[columnsSymbol]),
  }));

const schemaPushCommand = "yarn workspace @workspace/db run push";

function expectedColumnType(column) {
  const sqlType = column.getSQLType();
  return {
    dataType:
      sqlType === "serial"
        ? "integer"
        : sqlType.startsWith("numeric(")
          ? "numeric"
          : sqlType,
    numericPrecision:
      column.columnType === "PgNumeric" && column.precision !== undefined
        ? column.precision
        : null,
    numericScale:
      column.columnType === "PgNumeric" && column.scale !== undefined
        ? column.scale
        : null,
    datetimePrecision:
      column.columnType === "PgTimestamp" ? (column.precision ?? 6) : null,
  };
}

function describeColumnType(column) {
  const type = expectedColumnType(column);
  if (type.dataType === "numeric" && type.numericPrecision !== null) {
    return `${type.dataType}(${type.numericPrecision}, ${type.numericScale})`;
  }
  return type.dataType;
}

function describeActualColumnType(column) {
  if (column.data_type === "numeric" && column.numeric_precision !== null) {
    return `${column.data_type}(${column.numeric_precision}, ${column.numeric_scale})`;
  }
  return column.data_type;
}

function parseTextArray(value) {
  if (Array.isArray(value)) {
    return value;
  }
  if (!value || value === "{}") {
    return [];
  }
  return value.slice(1, -1).split(",");
}

function columnTypeMatches(expectedColumn, actualColumn) {
  const expectedType = expectedColumnType(expectedColumn);
  const actualNumericPrecision =
    actualColumn.data_type === "numeric"
      ? actualColumn.numeric_precision
      : null;
  const actualNumericScale =
    actualColumn.data_type === "numeric" ? actualColumn.numeric_scale : null;
  const actualDatetimePrecision = actualColumn.data_type.startsWith("timestamp")
    ? actualColumn.datetime_precision
    : null;
  return (
    expectedType.dataType === actualColumn.data_type &&
    expectedType.numericPrecision === actualNumericPrecision &&
    expectedType.numericScale === actualNumericScale &&
    expectedType.datetimePrecision === actualDatetimePrecision
  );
}

function getExpectedConstraints(table) {
  const config = getTableConfig(table.table);
  const constraints = [];
  const primaryKeyColumns = config.primaryKeys.flatMap((primaryKey) =>
    primaryKey.columns.map((column) => column.name),
  );
  const inlinePrimaryKeyColumns = table.columns
    .filter((column) => column.primary)
    .map((column) => column.name);
  for (const columnName of inlinePrimaryKeyColumns) {
    if (!primaryKeyColumns.includes(columnName)) primaryKeyColumns.push(columnName);
  }

  if (primaryKeyColumns.length > 0) {
    constraints.push({
      type: "p",
      name: `${table.name}_pkey`,
      columns: primaryKeyColumns,
    });
  }

  for (const foreignKey of config.foreignKeys) {
    const reference = foreignKey.reference();
    constraints.push({
      type: "f",
      name: foreignKey.getName(),
      columns: reference.columns.map((column) => column.name),
      foreignTable: reference.foreignTable[tableNameSymbol],
      foreignColumns: reference.foreignColumns.map((column) => column.name),
      onDelete: foreignKey.onDelete,
      onUpdate: foreignKey.onUpdate,
    });
  }

  return constraints;
}

function constraintSignature(constraint) {
  if (constraint.type === "p") {
    return `p:${constraint.columns.join(",")}`;
  }
  return [
    "f",
    constraint.columns.join(","),
    constraint.foreignTable,
    constraint.foreignColumns.join(","),
    constraint.onDelete,
    constraint.onUpdate,
  ].join(":");
}

function describeConstraint(constraint) {
  if (constraint.type === "p") {
    return `primary key (${constraint.columns.join(", ")})`;
  }
  return [
    `foreign key (${constraint.columns.join(", ")})`,
    `references ${constraint.foreignTable} (${constraint.foreignColumns.join(", ")})`,
    `on delete ${constraint.onDelete}`,
    `on update ${constraint.onUpdate}`,
  ].join(" ");
}

if (!process.env.DATABASE_URL) {
  throw new Error(
    [
      "Development database schema validation cannot run because DATABASE_URL is not set.",
      `After provisioning the development database, run: ${schemaPushCommand}`,
    ].join("\n"),
  );
}

const client = new Client({ connectionString: process.env.DATABASE_URL });

try {
  await client.connect();

  const result = await client.query(
    `
      SELECT
        table_name,
        column_name,
        data_type,
        is_nullable,
        numeric_precision,
        numeric_scale,
        datetime_precision
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = ANY($1::text[])
    `,
    [expectedTables.map((table) => table.name)],
  );

  const actualColumnsByTable = new Map();
  for (const row of result.rows) {
    const columnsForTable =
      actualColumnsByTable.get(row.table_name) ?? new Map();
    columnsForTable.set(row.column_name, row);
    actualColumnsByTable.set(row.table_name, columnsForTable);
  }

  const missingColumns = expectedTables.flatMap((table) => {
    const actualColumns = actualColumnsByTable.get(table.name) ?? new Map();
    return table.columns
      .filter((column) => !actualColumns.has(column.name))
      .map((column) => `${table.name}.${column.name}`);
  });

  const schemaDrift = missingColumns.map(
    (columnName) => `${columnName}: column is missing`,
  );

  for (const table of expectedTables) {
    if (!highRiskTableNames.has(table.name)) {
      continue;
    }

    const actualColumns = actualColumnsByTable.get(table.name);
    if (!actualColumns) {
      continue;
    }

    for (const expectedColumn of table.columns) {
      const actualColumn = actualColumns.get(expectedColumn.name);
      if (!actualColumn) {
        continue;
      }

      if (!columnTypeMatches(expectedColumn, actualColumn)) {
        schemaDrift.push(
          `${table.name}.${expectedColumn.name}: data type expected ${describeColumnType(expectedColumn)}, found ${describeActualColumnType(actualColumn)}`,
        );
      }

      const expectedNullable = !expectedColumn.notNull;
      const actualNullable = actualColumn.is_nullable === "YES";
      if (expectedNullable !== actualNullable) {
        schemaDrift.push(
          `${table.name}.${expectedColumn.name}: nullability expected ${expectedNullable ? "NULL" : "NOT NULL"}, found ${actualNullable ? "NULL" : "NOT NULL"}`,
        );
      }
    }
  }

  const constraintResult = await client.query(
    `
      SELECT
        constraints.local_table_name AS table_name,
        constraint_name,
        constraint_type,
        local_columns,
        foreign_table.relname AS foreign_table,
        foreign_columns,
        on_delete,
        on_update
      FROM (
        SELECT
          con.oid,
          local_table.relname AS local_table_name,
          con.conname AS constraint_name,
          con.contype AS constraint_type,
          ARRAY(
            SELECT attribute.attname
            FROM unnest(con.conkey) WITH ORDINALITY AS key(attnum, ordinal)
            JOIN pg_attribute AS attribute
              ON attribute.attrelid = con.conrelid
             AND attribute.attnum = key.attnum
            ORDER BY key.ordinal
          ) AS local_columns,
          foreign_table.oid AS foreign_table_oid,
          ARRAY(
            SELECT attribute.attname
            FROM unnest(con.confkey) WITH ORDINALITY AS key(attnum, ordinal)
            JOIN pg_attribute AS attribute
              ON attribute.attrelid = con.confrelid
             AND attribute.attnum = key.attnum
            ORDER BY key.ordinal
          ) AS foreign_columns,
          CASE con.confdeltype
            WHEN 'a' THEN 'no action'
            WHEN 'r' THEN 'restrict'
            WHEN 'c' THEN 'cascade'
            WHEN 'n' THEN 'set null'
            WHEN 'd' THEN 'set default'
          END AS on_delete,
          CASE con.confupdtype
            WHEN 'a' THEN 'no action'
            WHEN 'r' THEN 'restrict'
            WHEN 'c' THEN 'cascade'
            WHEN 'n' THEN 'set null'
            WHEN 'd' THEN 'set default'
          END AS on_update
        FROM pg_constraint AS con
        JOIN pg_class AS local_table ON local_table.oid = con.conrelid
        LEFT JOIN pg_class AS foreign_table ON foreign_table.oid = con.confrelid
        JOIN pg_namespace AS namespace ON namespace.oid = local_table.relnamespace
        WHERE namespace.nspname = 'public'
          AND local_table.relname = ANY($1::text[])
          AND con.contype IN ('p', 'f')
      ) AS constraints
      LEFT JOIN pg_class AS foreign_table ON foreign_table.oid = constraints.foreign_table_oid
      ORDER BY constraints.local_table_name, constraint_name
    `,
    [[...highRiskTableNames]],
  );

  const actualConstraintsByTable = new Map();
  for (const row of constraintResult.rows) {
    const constraintsForTable =
      actualConstraintsByTable.get(row.table_name) ?? [];
    constraintsForTable.push({
      type: row.constraint_type,
      name: row.constraint_name,
      columns: parseTextArray(row.local_columns),
      foreignTable: row.foreign_table,
      foreignColumns: parseTextArray(row.foreign_columns),
      onDelete: row.on_delete,
      onUpdate: row.on_update,
    });
    actualConstraintsByTable.set(row.table_name, constraintsForTable);
  }

  for (const table of expectedTables) {
    if (!highRiskTableNames.has(table.name)) {
      continue;
    }

    const actualColumns = actualColumnsByTable.get(table.name);
    if (!actualColumns) {
      continue;
    }

    const expectedConstraints = getExpectedConstraints(table);
    const actualConstraints = actualConstraintsByTable.get(table.name) ?? [];
    const actualConstraintsBySignature = new Map(
      actualConstraints.map((constraint) => [
        constraintSignature(constraint),
        constraint,
      ]),
    );

    for (const expectedConstraint of expectedConstraints) {
      if (
        !actualConstraintsBySignature.has(
          constraintSignature(expectedConstraint),
        )
      ) {
        schemaDrift.push(
          `${table.name}.${expectedConstraint.name}: ${describeConstraint(expectedConstraint)} is missing`,
        );
      }
    }

    const expectedConstraintsBySignature = new Map(
      expectedConstraints.map((constraint) => [
        constraintSignature(constraint),
        constraint,
      ]),
    );
    for (const actualConstraint of actualConstraints) {
      if (
        !expectedConstraintsBySignature.has(
          constraintSignature(actualConstraint),
        )
      ) {
        schemaDrift.push(
          `${table.name}.${actualConstraint.name}: unexpected ${describeConstraint(actualConstraint)}`,
        );
      }
    }
  }

  if (schemaDrift.length > 0) {
    throw new Error(
      [
        "Development database schema drift detected.",
        "The database does not match the application schema:",
        ...schemaDrift.map((issue) => `- ${issue}`),
        "",
        `Apply the current application schema to the development database with: ${schemaPushCommand}`,
        "This validation is read-only and does not modify any database.",
      ].join("\n"),
    );
  }

  const checkedColumnCount = expectedTables.reduce(
    (count, table) => count + table.columns.length,
    0,
  );
  const checkedConstraintCount = expectedTables
    .filter((table) => highRiskTableNames.has(table.name))
    .reduce((count, table) => count + getExpectedConstraints(table).length, 0);
  console.log(
    `Development database schema is aligned (${expectedTables.length} tables and ${checkedColumnCount} columns checked; ${checkedConstraintCount} high-risk constraints checked).`,
  );
} finally {
  await client.end();
}
