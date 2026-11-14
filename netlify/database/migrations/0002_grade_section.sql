-- Adds the grade and section to each donation or volunteer record.
ALTER TABLE contributions ADD COLUMN IF NOT EXISTS grade_section TEXT NOT NULL DEFAULT '';
