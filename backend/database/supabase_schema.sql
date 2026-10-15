-- Gym Management System Schema for Supabase (PostgreSQL)

CREATE TABLE IF NOT EXISTS gym_settings (
  id SMALLINT PRIMARY KEY DEFAULT 1,
  gym_name VARCHAR(120) NOT NULL DEFAULT 'Titan Iron Gym & Fitness',
  address VARCHAR(255) DEFAULT '123 Fitness Ave, Makati, Metro Manila',
  phone VARCHAR(40) DEFAULT '+63 912 345 6789',
  email VARCHAR(160) DEFAULT 'contact@titanirongym.ph',
  currency CHAR(3) NOT NULL DEFAULT 'PHP',
  timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Manila',
  grace_period_days SMALLINT NOT NULL DEFAULT 3,
  checkin_requires_payment BOOLEAN NOT NULL DEFAULT TRUE,
  expiring_soon_days SMALLINT NOT NULL DEFAULT 7,
  default_session_minutes SMALLINT NOT NULL DEFAULT 60,
  receipt_footer VARCHAR(255) DEFAULT 'Thank you for training with us!',
  updated_by INT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_settings_singleton CHECK (id = 1)
);

CREATE TABLE IF NOT EXISTS trainers (
  id SERIAL PRIMARY KEY,
  trainer_code VARCHAR(20) UNIQUE NOT NULL,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(160) UNIQUE NOT NULL,
  phone VARCHAR(40),
  specialization VARCHAR(120),
  experience_years SMALLINT NOT NULL DEFAULT 0,
  availability VARCHAR(255),
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','on_leave','inactive')),
  bio TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS members (
  id SERIAL PRIMARY KEY,
  member_code VARCHAR(20) UNIQUE NOT NULL,
  first_name VARCHAR(80) NOT NULL,
  last_name VARCHAR(80) NOT NULL,
  email VARCHAR(160) UNIQUE NOT NULL,
  phone VARCHAR(40),
  address VARCHAR(255),
  date_of_birth DATE,
  gender VARCHAR(20) CHECK (gender IN ('male','female','other','prefer_not_to_say')),
  registration_date DATE NOT NULL DEFAULT CURRENT_DATE,
  emergency_contact_name VARCHAR(120),
  emergency_contact_phone VARCHAR(40),
  profile_image_url VARCHAR(500),
  trainer_id INT REFERENCES trainers(id) ON DELETE SET NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','archived')),
  notes TEXT,
  archived_at TIMESTAMPTZ,
  created_by INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(160) UNIQUE NOT NULL,
  password_hash VARCHAR(100) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('admin','staff','trainer','member')),
  member_id INT REFERENCES members(id) ON DELETE SET NULL,
  trainer_id INT REFERENCES trainers(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  token_version INT NOT NULL DEFAULT 0,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS membership_plans (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  description VARCHAR(500),
  duration_value SMALLINT NOT NULL CHECK (duration_value > 0),
  duration_unit VARCHAR(10) NOT NULL CHECK (duration_unit IN ('day','week','month','year')),
  price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id SERIAL PRIMARY KEY,
  member_id INT NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
  plan_id INT NOT NULL REFERENCES membership_plans(id) ON DELETE RESTRICT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired','cancelled')),
  payment_status VARCHAR(20) NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid','partial','paid','refunded')),
  renewed_from_id INT REFERENCES subscriptions(id) ON DELETE SET NULL,
  notes VARCHAR(500),
  cancelled_at TIMESTAMPTZ,
  created_by INT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_subs_dates CHECK (end_date >= start_date)
);

CREATE TABLE IF NOT EXISTS attendance (
  id SERIAL PRIMARY KEY,
  member_id INT NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
  check_in TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  check_out TIMESTAMPTZ,
  recorded_by INT REFERENCES users(id) ON DELETE SET NULL,
  notes VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_att_times CHECK (check_out IS NULL OR check_out >= check_in)
);

-- Partial unique index ensuring only one open check-in per member at a time
CREATE UNIQUE INDEX IF NOT EXISTS uq_attendance_open ON attendance (member_id) WHERE check_out IS NULL;

CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  receipt_no VARCHAR(30) UNIQUE NOT NULL,
  member_id INT NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
  subscription_id INT REFERENCES subscriptions(id) ON DELETE RESTRICT,
  amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  payment_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  method VARCHAR(20) NOT NULL CHECK (method IN ('cash','bank_transfer','e_wallet','card')),
  reference VARCHAR(100),
  status VARCHAR(20) NOT NULL DEFAULT 'completed' CHECK (status IN ('pending','completed','refunded')),
  description VARCHAR(255),
  idempotency_key VARCHAR(64) UNIQUE,
  recorded_by INT REFERENCES users(id) ON DELETE SET NULL,
  updated_by INT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payment_audit (
  id SERIAL PRIMARY KEY,
  payment_id INT NOT NULL REFERENCES payments(id) ON DELETE RESTRICT,
  action VARCHAR(20) NOT NULL,
  old_status VARCHAR(20),
  new_status VARCHAR(20),
  old_amount NUMERIC(10,2),
  new_amount NUMERIC(10,2),
  reason VARCHAR(255),
  user_id INT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS training_sessions (
  id SERIAL PRIMARY KEY,
  trainer_id INT NOT NULL REFERENCES trainers(id) ON DELETE RESTRICT,
  member_id INT NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
  title VARCHAR(120) NOT NULL DEFAULT 'Personal training',
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','completed','cancelled','no_show')),
  notes VARCHAR(500),
  cancel_reason VARCHAR(255),
  created_by INT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_sess_times CHECK (end_time > start_time)
);

CREATE TABLE IF NOT EXISTS workout_plans (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  member_id INT NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
  trainer_id INT REFERENCES trainers(id) ON DELETE SET NULL,
  goal VARCHAR(255),
  schedule VARCHAR(255),
  start_date DATE,
  end_date DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','archived')),
  notes TEXT,
  created_by INT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_wp_dates CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date)
);

CREATE TABLE IF NOT EXISTS workout_exercises (
  id SERIAL PRIMARY KEY,
  plan_id INT NOT NULL REFERENCES workout_plans(id) ON DELETE CASCADE,
  day_label VARCHAR(40),
  exercise_name VARCHAR(120) NOT NULL,
  sets SMALLINT NOT NULL DEFAULT 3 CHECK (sets > 0),
  reps VARCHAR(20) NOT NULL DEFAULT '10',
  weight VARCHAR(40),
  rest_seconds SMALLINT,
  notes VARCHAR(255),
  sort_order SMALLINT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS workout_logs (
  id SERIAL PRIMARY KEY,
  plan_id INT NOT NULL REFERENCES workout_plans(id) ON DELETE CASCADE,
  completed_on DATE NOT NULL,
  notes VARCHAR(255),
  logged_by INT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_wl_plan_day UNIQUE (plan_id, completed_on)
);

CREATE TABLE IF NOT EXISTS equipment (
  id SERIAL PRIMARY KEY,
  equipment_code VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(120) NOT NULL,
  category VARCHAR(30) NOT NULL CHECK (category IN ('free_weights','cardio','strength_machine','functional','accessories','other')),
  brand VARCHAR(80),
  model VARCHAR(80),
  quantity INT NOT NULL DEFAULT 1 CHECK (quantity > 0),
  out_of_service_qty INT NOT NULL DEFAULT 0,
  purchase_date DATE,
  purchase_price NUMERIC(12,2) CHECK (purchase_price IS NULL OR purchase_price >= 0),
  location VARCHAR(120),
  condition VARCHAR(20) NOT NULL DEFAULT 'good' CHECK (condition IN ('excellent','good','fair','poor','damaged')),
  status VARCHAR(20) NOT NULL DEFAULT 'available' CHECK (status IN ('available','in_use','damaged','under_maintenance','retired')),
  maintenance_interval_days SMALLINT,
  last_maintenance_date DATE,
  next_maintenance_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_eq_oos CHECK (out_of_service_qty <= quantity)
);

CREATE TABLE IF NOT EXISTS equipment_purchases (
  id SERIAL PRIMARY KEY,
  equipment_id INT NOT NULL REFERENCES equipment(id) ON DELETE RESTRICT,
  purchase_date DATE NOT NULL,
  quantity INT NOT NULL CHECK (quantity > 0),
  unit_cost NUMERIC(12,2) NOT NULL CHECK (unit_cost >= 0),
  supplier VARCHAR(120),
  reference VARCHAR(100),
  recorded_by INT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS maintenance_records (
  id SERIAL PRIMARY KEY,
  equipment_id INT NOT NULL REFERENCES equipment(id) ON DELETE RESTRICT,
  issue_description VARCHAR(500) NOT NULL,
  maintenance_type VARCHAR(20) NOT NULL CHECK (maintenance_type IN ('preventive','corrective','inspection','repair','replacement')),
  priority VARCHAR(20) NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','critical')),
  reported_date DATE NOT NULL,
  scheduled_date DATE,
  completed_date DATE,
  technician VARCHAR(120),
  cost NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (cost >= 0),
  status VARCHAR(20) NOT NULL DEFAULT 'reported' CHECK (status IN ('reported','scheduled','in_progress','completed','cancelled')),
  affected_qty INT NOT NULL DEFAULT 0,
  condition_after VARCHAR(20) CHECK (condition_after IS NULL OR condition_after IN ('excellent','good','fair','poor','damaged')),
  notes TEXT,
  reported_by INT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_mr_dates CHECK (completed_date IS NULL OR completed_date >= reported_date)
);

CREATE TABLE IF NOT EXISTS activity_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(60) NOT NULL,
  entity_type VARCHAR(40) NOT NULL,
  entity_id INT,
  details VARCHAR(1000),
  ip_address VARCHAR(45),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Seed initial settings
INSERT INTO gym_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
