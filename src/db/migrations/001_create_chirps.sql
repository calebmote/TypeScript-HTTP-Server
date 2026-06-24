CREATE TABLE IF NOT EXISTS chirps (
  id uuid PRIMARY KEY,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  body varchar(280) NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE
);
