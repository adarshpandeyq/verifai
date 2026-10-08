CREATE TABLE "verifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"claim" text NOT NULL,
	"thumbnail" text,
	"verdict" text NOT NULL,
	"confidence" integer NOT NULL,
	"text_image_consistency" integer,
	"evidence_support" integer NOT NULL,
	"evidence_contradiction" integer NOT NULL,
	"evidence_mode" text NOT NULL,
	"live_retrieval_succeeded" boolean DEFAULT false NOT NULL,
	"text_analysis" jsonb NOT NULL,
	"image_analysis" jsonb NOT NULL,
	"consistency" jsonb,
	"evidence" jsonb NOT NULL,
	"reasoning" jsonb NOT NULL,
	"summary" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
