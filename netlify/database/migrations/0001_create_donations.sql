-- Trece Martires Elementary School · Donations & Volunteers Record
-- Netlify applies this automatically on deploy.

CREATE TABLE app_settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- One account per role: admin, teacher, viewer.
CREATE TABLE accounts (
  role        TEXT PRIMARY KEY CHECK (role IN ('admin', 'teacher', 'viewer')),
  username    TEXT NOT NULL,
  pass_hash   TEXT NOT NULL,
  version     INTEGER NOT NULL DEFAULT 1,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX accounts_username_lower ON accounts (lower(username));

CREATE TABLE login_fails (
  ip  TEXT NOT NULL,
  at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX login_fails_ip_at ON login_fails (ip, at);

-- Teachers and staff who receive donations
CREATE TABLE staff (
  id        SERIAL PRIMARY KEY,
  name      TEXT NOT NULL,
  role      TEXT NOT NULL DEFAULT '',
  grp       TEXT NOT NULL DEFAULT 'Others',
  position  INTEGER NOT NULL DEFAULT 0
);

-- One row per contribution: money, volunteer hours, or things (in kind).
CREATE TABLE contributions (
  id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  date_given        DATE NOT NULL,
  name              TEXT NOT NULL,
  contributor_type  TEXT NOT NULL DEFAULT '',
  kind              TEXT NOT NULL CHECK (kind IN ('money', 'hours', 'items')),
  amount            NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  hours             NUMERIC(7,2)  NOT NULL DEFAULT 0 CHECK (hours >= 0),
  item_desc         TEXT NOT NULL DEFAULT '',
  item_qty          INTEGER NOT NULL DEFAULT 0 CHECK (item_qty >= 0),
  item_unit         TEXT NOT NULL DEFAULT '',
  est_value         NUMERIC(12,2) CHECK (est_value IS NULL OR est_value >= 0),
  activity          TEXT NOT NULL DEFAULT '',
  received_by       TEXT NOT NULL DEFAULT '',
  remarks           TEXT NOT NULL DEFAULT '',
  recorded_as       TEXT NOT NULL DEFAULT '',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX contributions_date ON contributions (date_given DESC);

INSERT INTO staff (name, role, grp, position) VALUES
  ('Joan E. Fresto',          'Kindergarten – Aguinaldo and Bonifacio', 'Teachers', 1),
  ('Josephine J. Masarate',   'Grade 1 – Burgos',      'Teachers', 2),
  ('Leny N. Giba',            'Grade 1 – Del Pilar',   'Teachers', 3),
  ('Jocel J. Erestain',       'Grade 2 – Jacinto',     'Teachers', 4),
  ('Milagros E. Hapin',       'Grade 2 – Jaena',       'Teachers', 5),
  ('Delia E. Villareal',      'Grade 3 – Lapu-Lapu',   'Teachers', 6),
  ('Maricel B. Jaylo',        'Grade 3 – Luna',        'Teachers', 7),
  ('Rhoda J. Ledesma',        'Grade 4 – Mabini',      'Teachers', 8),
  ('Nickol Hular',            'Grade 4 – Malvar',      'Teachers', 9),
  ('Michelle E. Dometita',    'Grade 5 – Quezon',      'Teachers', 10),
  ('Gina H. Dorado',          'Grade 5 – Rizal',       'Teachers', 11),
  ('Herminia H. Hadap',       'Grade 6 – Silang',      'Teachers', 12),
  ('Jocelyn H. Zamora',       'Grade 6 – Zamora',      'Teachers', 13),
  ('Catherine Jane D. Janer', 'Aral Room',             'Teachers', 14),
  ('Michael Domanais',        'School Principal',      'Administration', 15),
  ('Danah Jane Holdiem',      'Administrative Officer II', 'Administration', 16);
