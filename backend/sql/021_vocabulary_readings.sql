ALTER TABLE vocabularies
  ADD COLUMN IF NOT EXISTS part_of_speech TEXT,
  ADD COLUMN IF NOT EXISTS pronunciation TEXT;
