import "dotenv/config";
import { defineConfig } from "prisma/config";

// Config de Prisma 7. La URL de conexión ya no va en el schema.
// Se usa `process.env` directamente (en vez del helper `env()`) para que
// comandos como `prisma generate` no fallen si DATABASE_URL no está seteada.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DATABASE_URL ?? "",
  },
});
