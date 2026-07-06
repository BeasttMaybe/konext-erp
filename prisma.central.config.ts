import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/central/schema.prisma",
  migrations: {
    path: "prisma/central/migrations",
  },
  datasource: {
    url: process.env["CENTRAL_DATABASE_URL"],
  },
});
