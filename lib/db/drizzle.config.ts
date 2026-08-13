import { defineConfig } from "drizzle-kit";

const dbUrl = process.env.APP_DATABASE_URL ?? process.env.DATABASE_URL;
if (!dbUrl) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  schema: "./src/schema/*.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: dbUrl,
  },
});
