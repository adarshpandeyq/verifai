import {
  boolean,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const verifications = pgTable("verifications", {
  id: serial("id").primaryKey(),
  claim: text("claim").notNull(),
  thumbnail: text("thumbnail"),
  verdict: text("verdict").notNull(),
  confidence: integer("confidence").notNull(),
  textImageConsistency: integer("text_image_consistency"),
  evidenceSupport: integer("evidence_support").notNull(),
  evidenceContradiction: integer("evidence_contradiction").notNull(),
  evidenceMode: text("evidence_mode").notNull(),
  liveRetrievalSucceeded: boolean("live_retrieval_succeeded").notNull().default(false),
  textAnalysis: jsonb("text_analysis").notNull(),
  imageAnalysis: jsonb("image_analysis").notNull(),
  consistency: jsonb("consistency"),
  evidence: jsonb("evidence").notNull(),
  reasoning: jsonb("reasoning").notNull(),
  summary: text("summary").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
