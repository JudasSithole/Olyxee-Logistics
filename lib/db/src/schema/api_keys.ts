import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { businessesTable } from "./businesses";

// Per-business API keys for the future public /api/v1 surface. Only a hash of
// the key is stored; the plaintext is shown once at creation time. The public
// API stays disabled behind featureFlags.publicApi in this release.
export const apiKeysTable = pgTable("api_keys", {
  id: text("id").primaryKey(),
  businessId: text("business_id")
    .notNull()
    .references(() => businessesTable.id),
  name: text("name").notNull(),
  // First few chars of the key, shown in the UI to identify it (not a secret).
  keyPrefix: text("key_prefix").notNull(),
  // SHA-256 of the full key. The plaintext is never persisted.
  keyHash: text("key_hash").notNull().unique(),
  lastUsedAt: timestamp("last_used_at"),
  revokedAt: timestamp("revoked_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertApiKeySchema = createInsertSchema(apiKeysTable);
export type InsertApiKey = z.infer<typeof insertApiKeySchema>;
export type ApiKey = typeof apiKeysTable.$inferSelect;
