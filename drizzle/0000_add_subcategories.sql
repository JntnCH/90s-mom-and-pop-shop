BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE TABLE IF NOT EXISTS public."sub_categories" (
  "id" text PRIMARY KEY NOT NULL,
  "category_id" text NOT NULL,
  "code" text NOT NULL,
  "name" text NOT NULL,
  "created_at" timestamp DEFAULT now()
);

ALTER TABLE public."products"
  ADD COLUMN IF NOT EXISTS "sub_category_id" text;

COMMIT;
