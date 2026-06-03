import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "backend/prisma/schema.prisma",
  migrations: {
    path: "backend/prisma/migrations",
  },
  datasource: {
    // URL directa sin PgBouncer — obligatorio para migraciones en Neon
    url: process.env["DATABASE_URL_UNPOOLED"],
  },
});
