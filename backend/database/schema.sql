-- Gym Management System schema (MySQL 8 / MariaDB 10.4+)
-- All DATETIME columns hold UTC values. DATE columns hold calendar dates in the gym's local timezone.

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS gym_settings (
  id TINYINT UNSIGNED NOT NULL PRIMARY KEY DEFAULT 1,
  gym_name VARCHAR(120) NOT NULL DEFAULT 'My Gym',
  address VARCHAR(255) NULL,
  phone VARCHAR(40) NULL,
  email VARCHAR(160) NULL,
  currency CHAR(3) NOT NULL DEFAULT 'PHP',
  timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Manila',
  grace_period_days SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  checkin_requires_payment TINYINT(1) NOT NULL DEFAULT 1,
  expiring_soon_days SMALLINT UNSIGNED NOT NULL DEFAULT 7,
  default_session_minutes SMALLINT UNSIGNED NOT NULL DEFAULT 60,
  receipt_footer VARCHAR(255) NULL,
  updated_by INT UNSIGNED NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT chk_settings_singleton CHECK (id = 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS trainers (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  trainer_code VARCHAR(20) NOT NULL,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(160) NOT NULL,
  phone VARCHAR(40) NULL,
  specialization VARCHAR(120) NULL,
  experience_years TINYINT UNSIGNED NOT NULL DEFAULT 0,
  availability VARCHAR(255) NULL,
  status ENUM('active','on_leave','inactive') NOT NULL DEFAULT 'active',
  bio TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_trainers_code (trainer_code),
  UNIQUE KEY uq_trainers_email (email),
  KEY idx_trainers_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS members (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  member_code VARCHAR(20) NOT NULL,
  first_name VARCHAR(80) NOT NULL,
  last_name VARCHAR(80) NOT NULL,
  email VARCHAR(160) NOT NULL,
  phone VARCHAR(40) NULL,
  address VARCHAR(255) NULL,
  date_of_birth DATE NULL,
  gender ENUM('male','female','other','prefer_not_to_say') NULL,
  registration_date DATE NOT NULL,
  emergency_contact_name VARCHAR(120) NULL,
  emergency_contact_phone VARCHAR(40) NULL,
  profile_image_url VARCHAR(500) NULL,
  trainer_id INT UNSIGNED NULL,
  status ENUM('active','inactive','archived') NOT NULL DEFAULT 'active',
  notes TEXT NULL,
  archived_at DATETIME NULL,
  created_by INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_members_code (member_code),
  UNIQUE KEY uq_members_email (email),
  KEY idx_members_status (status),
  KEY idx_members_name (last_name, first_name),
  KEY idx_members_registration (registration_date),
  CONSTRAINT fk_members_trainer FOREIGN KEY (trainer_id) REFERENCES trainers(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(160) NOT NULL,
  password_hash VARCHAR(100) NOT NULL,
  role ENUM('admin','staff','trainer','member') NOT NULL,
  member_id INT UNSIGNED NULL,
  trainer_id INT UNSIGNED NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  token_version INT UNSIGNED NOT NULL DEFAULT 0,
  last_login_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_users_email (email),
  UNIQUE KEY uq_users_member (member_id),
  UNIQUE KEY uq_users_trainer (trainer_id),
  KEY idx_users_role (role),
  CONSTRAINT fk_users_member FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE SET NULL,
  CONSTRAINT fk_users_trainer FOREIGN KEY (trainer_id) REFERENCES trainers(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS membership_plans (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description VARCHAR(500) NULL,
  duration_value SMALLINT UNSIGNED NOT NULL,
  duration_unit ENUM('day','week','month','year') NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  status ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_plans_name (name),
  CONSTRAINT chk_plans_price CHECK (price >= 0),
  CONSTRAINT chk_plans_duration CHECK (duration_value > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS subscriptions (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  member_id INT UNSIGNED NOT NULL,
  plan_id INT UNSIGNED NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  status ENUM('active','expired','cancelled') NOT NULL DEFAULT 'active',
  payment_status ENUM('unpaid','partial','paid','refunded') NOT NULL DEFAULT 'unpaid',
  renewed_from_id INT UNSIGNED NULL,
  notes VARCHAR(500) NULL,
  cancelled_at DATETIME NULL,
  created_by INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_subs_member (member_id, end_date),
  KEY idx_subs_status_end (status, end_date),
  CONSTRAINT fk_subs_member FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE RESTRICT,
  CONSTRAINT fk_subs_plan FOREIGN KEY (plan_id) REFERENCES membership_plans(id) ON DELETE RESTRICT,
  CONSTRAINT fk_subs_renewed FOREIGN KEY (renewed_from_id) REFERENCES subscriptions(id) ON DELETE SET NULL,
  CONSTRAINT fk_subs_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT chk_subs_dates CHECK (end_date >= start_date),
  CONSTRAINT chk_subs_price CHECK (price >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS attendance (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  member_id INT UNSIGNED NOT NULL,
  check_in DATETIME NOT NULL,
  check_out DATETIME NULL,
  -- 1 while checked in, NULL after check-out; the unique key blocks duplicate active check-ins.
  open_flag TINYINT AS (IF(check_out IS NULL, 1, NULL)) STORED,
  recorded_by INT UNSIGNED NULL,
  notes VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_attendance_open (member_id, open_flag),
  KEY idx_attendance_checkin (check_in),
  CONSTRAINT fk_att_member FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE RESTRICT,
  CONSTRAINT fk_att_user FOREIGN KEY (recorded_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT chk_att_times CHECK (check_out IS NULL OR check_out >= check_in)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payments (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  receipt_no VARCHAR(30) NOT NULL,
  member_id INT UNSIGNED NOT NULL,
  subscription_id INT UNSIGNED NULL,
  amount DECIMAL(10,2) NOT NULL,
  payment_date DATETIME NOT NULL,
  method ENUM('cash','bank_transfer','e_wallet','card') NOT NULL,
  reference VARCHAR(100) NULL,
  status ENUM('pending','completed','refunded') NOT NULL DEFAULT 'completed',
  description VARCHAR(255) NULL,
  idempotency_key VARCHAR(64) NULL,
  recorded_by INT UNSIGNED NULL,
  updated_by INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_payments_receipt (receipt_no),
  UNIQUE KEY uq_payments_idem (idempotency_key),
  KEY idx_payments_date (payment_date),
  KEY idx_payments_status (status, payment_date),
  KEY idx_payments_member (member_id),
  CONSTRAINT fk_pay_member FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE RESTRICT,
  CONSTRAINT fk_pay_sub FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE RESTRICT,
  CONSTRAINT fk_pay_recorder FOREIGN KEY (recorded_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_pay_updater FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT chk_pay_amount CHECK (amount > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payment_audit (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  payment_id INT UNSIGNED NOT NULL,
  action ENUM('created','status_changed','updated','refunded') NOT NULL,
  old_status VARCHAR(20) NULL,
  new_status VARCHAR(20) NULL,
  old_amount DECIMAL(10,2) NULL,
  new_amount DECIMAL(10,2) NULL,
  reason VARCHAR(255) NULL,
  user_id INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_paudit_payment (payment_id),
  CONSTRAINT fk_paudit_payment FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE RESTRICT,
  CONSTRAINT fk_paudit_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS training_sessions (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  trainer_id INT UNSIGNED NOT NULL,
  member_id INT UNSIGNED NOT NULL,
  title VARCHAR(120) NOT NULL DEFAULT 'Personal training',
  start_time DATETIME NOT NULL,
  end_time DATETIME NOT NULL,
  status ENUM('scheduled','completed','cancelled','no_show') NOT NULL DEFAULT 'scheduled',
  notes VARCHAR(500) NULL,
  cancel_reason VARCHAR(255) NULL,
  created_by INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_sessions_trainer_time (trainer_id, start_time, end_time),
  KEY idx_sessions_member (member_id, start_time),
  CONSTRAINT fk_sess_trainer FOREIGN KEY (trainer_id) REFERENCES trainers(id) ON DELETE RESTRICT,
  CONSTRAINT fk_sess_member FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE RESTRICT,
  CONSTRAINT fk_sess_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT chk_sess_times CHECK (end_time > start_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS workout_plans (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  member_id INT UNSIGNED NOT NULL,
  trainer_id INT UNSIGNED NULL,
  goal VARCHAR(255) NULL,
  schedule VARCHAR(255) NULL,
  start_date DATE NULL,
  end_date DATE NULL,
  status ENUM('active','completed','archived') NOT NULL DEFAULT 'active',
  notes TEXT NULL,
  created_by INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_wp_member (member_id),
  KEY idx_wp_trainer (trainer_id),
  CONSTRAINT fk_wp_member FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE RESTRICT,
  CONSTRAINT fk_wp_trainer FOREIGN KEY (trainer_id) REFERENCES trainers(id) ON DELETE SET NULL,
  CONSTRAINT fk_wp_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT chk_wp_dates CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS workout_exercises (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  plan_id INT UNSIGNED NOT NULL,
  day_label VARCHAR(40) NULL,
  exercise_name VARCHAR(120) NOT NULL,
  sets SMALLINT UNSIGNED NOT NULL DEFAULT 3,
  reps VARCHAR(20) NOT NULL DEFAULT '10',
  weight VARCHAR(40) NULL,
  rest_seconds SMALLINT UNSIGNED NULL,
  notes VARCHAR(255) NULL,
  sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  KEY idx_we_plan (plan_id, sort_order),
  CONSTRAINT fk_we_plan FOREIGN KEY (plan_id) REFERENCES workout_plans(id) ON DELETE CASCADE,
  CONSTRAINT chk_we_sets CHECK (sets > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS workout_logs (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  plan_id INT UNSIGNED NOT NULL,
  completed_on DATE NOT NULL,
  notes VARCHAR(255) NULL,
  logged_by INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_wl_plan_day (plan_id, completed_on),
  CONSTRAINT fk_wl_plan FOREIGN KEY (plan_id) REFERENCES workout_plans(id) ON DELETE CASCADE,
  CONSTRAINT fk_wl_user FOREIGN KEY (logged_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS equipment (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  equipment_code VARCHAR(20) NOT NULL,
  name VARCHAR(120) NOT NULL,
  category ENUM('free_weights','cardio','strength_machine','functional','accessories','other') NOT NULL,
  brand VARCHAR(80) NULL,
  model VARCHAR(80) NULL,
  quantity INT UNSIGNED NOT NULL DEFAULT 1,
  out_of_service_qty INT UNSIGNED NOT NULL DEFAULT 0,
  purchase_date DATE NULL,
  purchase_price DECIMAL(12,2) NULL,
  location VARCHAR(120) NULL,
  `condition` ENUM('excellent','good','fair','poor','damaged') NOT NULL DEFAULT 'good',
  status ENUM('available','in_use','damaged','under_maintenance','retired') NOT NULL DEFAULT 'available',
  maintenance_interval_days SMALLINT UNSIGNED NULL,
  last_maintenance_date DATE NULL,
  next_maintenance_date DATE NULL,
  notes TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_equipment_code (equipment_code),
  KEY idx_equipment_status (status),
  KEY idx_equipment_category (category),
  KEY idx_equipment_next_maint (next_maintenance_date),
  CONSTRAINT chk_eq_oos CHECK (out_of_service_qty <= quantity),
  CONSTRAINT chk_eq_price CHECK (purchase_price IS NULL OR purchase_price >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS equipment_purchases (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  equipment_id INT UNSIGNED NOT NULL,
  purchase_date DATE NOT NULL,
  quantity INT UNSIGNED NOT NULL,
  unit_cost DECIMAL(12,2) NOT NULL,
  supplier VARCHAR(120) NULL,
  reference VARCHAR(100) NULL,
  recorded_by INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_ep_equipment (equipment_id),
  CONSTRAINT fk_ep_equipment FOREIGN KEY (equipment_id) REFERENCES equipment(id) ON DELETE RESTRICT,
  CONSTRAINT fk_ep_user FOREIGN KEY (recorded_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT chk_ep_qty CHECK (quantity > 0),
  CONSTRAINT chk_ep_cost CHECK (unit_cost >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS maintenance_records (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  equipment_id INT UNSIGNED NOT NULL,
  issue_description VARCHAR(500) NOT NULL,
  maintenance_type ENUM('preventive','corrective','inspection','repair','replacement') NOT NULL,
  priority ENUM('low','medium','high','critical') NOT NULL DEFAULT 'medium',
  reported_date DATE NOT NULL,
  scheduled_date DATE NULL,
  completed_date DATE NULL,
  technician VARCHAR(120) NULL,
  cost DECIMAL(10,2) NOT NULL DEFAULT 0,
  status ENUM('reported','scheduled','in_progress','completed','cancelled') NOT NULL DEFAULT 'reported',
  affected_qty INT UNSIGNED NOT NULL DEFAULT 0,
  condition_after ENUM('excellent','good','fair','poor','damaged') NULL,
  notes TEXT NULL,
  reported_by INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_mr_equipment (equipment_id),
  KEY idx_mr_status_sched (status, scheduled_date),
  CONSTRAINT fk_mr_equipment FOREIGN KEY (equipment_id) REFERENCES equipment(id) ON DELETE RESTRICT,
  CONSTRAINT fk_mr_user FOREIGN KEY (reported_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT chk_mr_cost CHECK (cost >= 0),
  CONSTRAINT chk_mr_dates CHECK (completed_date IS NULL OR completed_date >= reported_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS activity_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NULL,
  action VARCHAR(60) NOT NULL,
  entity_type VARCHAR(40) NOT NULL,
  entity_id INT UNSIGNED NULL,
  details VARCHAR(1000) NULL,
  ip_address VARCHAR(45) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_logs_created (created_at),
  KEY idx_logs_entity (entity_type, entity_id),
  CONSTRAINT fk_logs_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO gym_settings (id) VALUES (1);

