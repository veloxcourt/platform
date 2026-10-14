import "dotenv/config";

import { ensureRuntimeSchema, prisma } from "../src/lib/prisma";

/// Aplica el DDL pendiente y muestra cómo quedó el catálogo de localidades.
/// Es el mismo DDL que corre la app al arrancar: aditivo e idempotente, se
/// puede repetir sin consecuencias. No usar `prisma db push` en su lugar:
/// compara contra el schema y puede decidir borrar columnas o tablas.
async function main() {
  await ensureRuntimeSchema();

  const [provinces, cities, aliases] = await Promise.all([
    prisma.province.count(),
    prisma.city.count(),
    prisma.cityAlias.count(),
  ]);

  const columns = await prisma.$queryRaw<
    { table_name: string; is_nullable: string; column_default: string | null }[]
  >`
    SELECT table_name, is_nullable, column_default
    FROM information_schema.columns
    WHERE column_name = 'catalogCityId'
      AND table_name IN ('users', 'clubs', 'club_requests')
    ORDER BY table_name
  `;

  const found = columns.map((column) => column.table_name);
  const missing = ["club_requests", "clubs", "users"].filter(
    (table) => !found.includes(table),
  );

  console.log(`provinces: ${provinces}`);
  console.log(`cities: ${cities}`);
  console.log(`city_aliases: ${aliases}`);
  for (const column of columns) {
    console.log(
      `${column.table_name}.catalogCityId -> admite null: ${column.is_nullable}, default: ${column.column_default ?? "ninguno"}`,
    );
  }
  if (missing.length > 0) {
    throw new Error(`Falta la columna catalogCityId en: ${missing.join(", ")}`);
  }

  // Si alguna quedara NOT NULL, una versión anterior de la app fallaría al
  // insertar un jugador o un club, porque no conoce la columna.
  const notNullable = columns.filter((column) => column.is_nullable !== "YES");
  if (notNullable.length > 0) {
    throw new Error(
      `catalogCityId debe admitir null en: ${notNullable.map((c) => c.table_name).join(", ")}`,
    );
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => {});
  });
