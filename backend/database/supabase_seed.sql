-- Sample Seed Data for Supabase (Titan Iron Gym)
-- Demo password for all accounts: Admin123!

INSERT INTO gym_settings (id, gym_name, address, phone, email, currency, timezone, grace_period_days, checkin_requires_payment, expiring_soon_days, default_session_minutes)
VALUES (1, 'Titan Iron Gym & Fitness', '123 Fitness Ave, Makati, Metro Manila', '+63 912 345 6789', 'contact@titanirongym.ph', 'PHP', 'Asia/Manila', 3, TRUE, 7, 60)
ON CONFLICT (id) DO UPDATE SET
  gym_name = EXCLUDED.gym_name,
  address = EXCLUDED.address,
  phone = EXCLUDED.phone,
  email = EXCLUDED.email,
  currency = EXCLUDED.currency,
  timezone = EXCLUDED.timezone;

INSERT INTO membership_plans (id, name, description, duration_value, duration_unit, price, status) VALUES
(1, 'Daily Pass', 'Single day pass with access to all gym equipment and locker rooms', 1, 'day', 250.00, 'active'),
(2, 'Weekly Membership', '7 days of unrestricted gym access', 1, 'week', 900.00, 'active'),
(3, 'Monthly Standard', 'Full monthly gym access + 1 free fitness assessment', 1, 'month', 2200.00, 'active'),
(4, 'Quarterly Pro', '3 months access with locker privilege and personal trainer consultation', 3, 'month', 5800.00, 'active'),
(5, 'Annual VIP', '12 months all-access VIP membership, unlimited group classes, 5 guest passes', 1, 'year', 19500.00, 'active')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  duration_value = EXCLUDED.duration_value,
  duration_unit = EXCLUDED.duration_unit,
  price = EXCLUDED.price,
  status = EXCLUDED.status;

INSERT INTO trainers (id, trainer_code, full_name, email, phone, specialization, experience_years, availability, status, bio) VALUES
(1, 'TRN-000001', 'Marcus Vance', 'marcus@titanirongym.ph', '+63 917 111 2233', 'Strength & Hypertrophy', 6, 'Mon-Fri 06:00-14:00', 'active', 'Certified CSCS strength coach with expertise in powerlifting and athletic conditioning.'),
(2, 'TRN-000002', 'Elena Rostova', 'elena@titanirongym.ph', '+63 917 222 3344', 'HIIT & Functional Fitness', 4, 'Mon-Sat 12:00-20:00', 'active', 'CrossFit Level 2 trainer specializing in weight loss and metabolic conditioning.'),
(3, 'TRN-000003', 'Dave Bautista', 'dave@titanirongym.ph', '+63 917 333 4455', 'Rehabilitation & Mobility', 8, 'Tue-Sun 08:00-16:00', 'active', 'Former physiotherapist clinic assistant focusing on posture correction and joint mobility.')
ON CONFLICT (id) DO UPDATE SET
  trainer_code = EXCLUDED.trainer_code,
  full_name = EXCLUDED.full_name,
  email = EXCLUDED.email,
  phone = EXCLUDED.phone,
  specialization = EXCLUDED.specialization,
  experience_years = EXCLUDED.experience_years,
  availability = EXCLUDED.availability,
  status = EXCLUDED.status,
  bio = EXCLUDED.bio;

INSERT INTO members (id, member_code, first_name, last_name, email, phone, address, date_of_birth, gender, registration_date, emergency_contact_name, emergency_contact_phone, trainer_id, status) VALUES
(1, 'MEM-000001', 'Juan', 'Dela Cruz', 'juan@example.com', '+63 920 123 4567', '742 Evergreen St, Quezon City', '1995-04-12', 'male', '2026-01-10', 'Maria Dela Cruz', '+63 920 999 8888', 1, 'active'),
(2, 'MEM-000002', 'Sarah', 'Jenkins', 'sarah@example.com', '+63 921 234 5678', '12 Bonifacio Ridge, Taguig', '1998-08-23', 'female', '2026-02-01', 'Robert Jenkins', '+63 921 888 7777', 2, 'active'),
(3, 'MEM-000003', 'Carlos', 'Reyes', 'carlos@example.com', '+63 922 345 6789', '45 Magsaysay Ave, Pasig', '1990-11-05', 'male', '2026-02-15', 'Ana Reyes', '+63 922 777 6666', 1, 'active'),
(4, 'MEM-000004', 'Maria', 'Santos', 'maria@example.com', '+63 923 456 7890', '88 Buendia Ave, Makati', '2001-02-18', 'female', '2026-03-01', 'Elena Santos', '+63 923 666 5555', NULL, 'active'),
(5, 'MEM-000005', 'David', 'Lim', 'david@example.com', '+63 924 567 8901', '101 Taft Ave, Manila', '1988-06-30', 'male', '2026-01-05', 'Grace Lim', '+63 924 555 4444', 3, 'active'),
(6, 'MEM-000006', 'Jessica', 'Alvarez', 'jessica@example.com', '+63 925 678 9012', '14 Ortigas Ave, San Juan', '1996-09-14', 'female', '2026-03-10', 'Paul Alvarez', '+63 925 444 3333', NULL, 'inactive')
ON CONFLICT (id) DO UPDATE SET
  member_code = EXCLUDED.member_code,
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  email = EXCLUDED.email,
  phone = EXCLUDED.phone,
  address = EXCLUDED.address,
  date_of_birth = EXCLUDED.date_of_birth,
  gender = EXCLUDED.gender,
  registration_date = EXCLUDED.registration_date,
  emergency_contact_name = EXCLUDED.emergency_contact_name,
  emergency_contact_phone = EXCLUDED.emergency_contact_phone,
  trainer_id = EXCLUDED.trainer_id,
  status = EXCLUDED.status;

INSERT INTO users (id, full_name, email, password_hash, role, member_id, trainer_id, is_active) VALUES
(1, 'System Administrator', 'admin@titanirongym.ph', '$2b$10$g8/7hiAGKciIR.EsDtd5DOrHVCAfwsCULf2Kq.GBAPLGVy0YzdVDW', 'admin', NULL, NULL, TRUE),
(2, 'Front Desk Staff', 'staff@titanirongym.ph', '$2b$10$g8/7hiAGKciIR.EsDtd5DOrHVCAfwsCULf2Kq.GBAPLGVy0YzdVDW', 'staff', NULL, NULL, TRUE),
(3, 'Marcus Vance', 'marcus@titanirongym.ph', '$2b$10$g8/7hiAGKciIR.EsDtd5DOrHVCAfwsCULf2Kq.GBAPLGVy0YzdVDW', 'trainer', NULL, 1, TRUE),
(4, 'Elena Rostova', 'elena@titanirongym.ph', '$2b$10$g8/7hiAGKciIR.EsDtd5DOrHVCAfwsCULf2Kq.GBAPLGVy0YzdVDW', 'trainer', NULL, 2, TRUE),
(5, 'Juan Dela Cruz', 'juan@example.com', '$2b$10$g8/7hiAGKciIR.EsDtd5DOrHVCAfwsCULf2Kq.GBAPLGVy0YzdVDW', 'member', 1, NULL, TRUE),
(6, 'Sarah Jenkins', 'sarah@example.com', '$2b$10$g8/7hiAGKciIR.EsDtd5DOrHVCAfwsCULf2Kq.GBAPLGVy0YzdVDW', 'member', 2, NULL, TRUE)
ON CONFLICT (id) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  email = EXCLUDED.email,
  password_hash = EXCLUDED.password_hash,
  role = EXCLUDED.role,
  member_id = EXCLUDED.member_id,
  trainer_id = EXCLUDED.trainer_id,
  is_active = EXCLUDED.is_active;

INSERT INTO subscriptions (id, member_id, plan_id, start_date, end_date, price, status, payment_status, created_by) VALUES
(1, 1, 4, '2026-08-15', '2026-11-15', 5800.00, 'active', 'paid', 1),
(2, 2, 3, '2026-10-01', '2026-10-31', 2200.00, 'active', 'paid', 2),
(3, 3, 5, '2026-02-15', '2027-02-14', 19500.00, 'active', 'paid', 1),
(4, 4, 3, '2026-10-01', '2026-10-31', 2200.00, 'active', 'paid', 2),
(5, 5, 2, '2026-03-10', '2026-03-16', 900.00, 'expired', 'paid', 2),
(6, 6, 1, '2026-03-10', '2026-03-10', 250.00, 'expired', 'paid', 2)
ON CONFLICT (id) DO UPDATE SET
  member_id = EXCLUDED.member_id,
  plan_id = EXCLUDED.plan_id,
  start_date = EXCLUDED.start_date,
  end_date = EXCLUDED.end_date,
  price = EXCLUDED.price,
  status = EXCLUDED.status,
  payment_status = EXCLUDED.payment_status;

INSERT INTO payments (id, receipt_no, member_id, subscription_id, amount, payment_date, method, reference, status, description, recorded_by) VALUES
(1, 'REC-2026-000001', 1, 1, 5800.00, CURRENT_TIMESTAMP - INTERVAL '30 days', 'bank_transfer', 'BDO-9823412', 'completed', 'Quarterly Pro Membership', 1),
(2, 'REC-2026-000002', 2, 2, 2200.00, CURRENT_TIMESTAMP - INTERVAL '15 days', 'e_wallet', 'GCASH-4910294', 'completed', 'Monthly Standard Membership', 2),
(3, 'REC-2026-000003', 3, 3, 19500.00, CURRENT_TIMESTAMP - INTERVAL '20 days', 'card', 'CARD-TXN-7712', 'completed', 'Annual VIP Membership', 1),
(4, 'REC-2026-000004', 4, 4, 2200.00, CURRENT_TIMESTAMP - INTERVAL '10 days', 'cash', 'CASH-REC-001', 'completed', 'Monthly Standard Membership', 2),
(5, 'REC-2026-000005', 5, 5, 900.00, CURRENT_TIMESTAMP - INTERVAL '40 days', 'cash', 'CASH-REC-002', 'completed', 'Weekly Pass', 2),
(6, 'REC-2026-000006', 6, 6, 250.00, CURRENT_TIMESTAMP - INTERVAL '45 days', 'cash', 'CASH-REC-003', 'completed', 'Daily Pass', 2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO attendance (id, member_id, check_in, check_out, recorded_by, notes) VALUES
(1, 1, CURRENT_TIMESTAMP - INTERVAL '1 day', CURRENT_TIMESTAMP - INTERVAL '22 hours', 2, 'Morning workout'),
(2, 2, CURRENT_TIMESTAMP - INTERVAL '1 day', CURRENT_TIMESTAMP - INTERVAL '23 hours', 2, 'HIIT session'),
(3, 3, CURRENT_TIMESTAMP - INTERVAL '2 days', CURRENT_TIMESTAMP - INTERVAL '46 hours', 2, 'Heavy squat day'),
(4, 1, CURRENT_TIMESTAMP - INTERVAL '2 hours', NULL, 2, 'Still in gym'),
(5, 4, CURRENT_TIMESTAMP - INTERVAL '1 hour', NULL, 2, 'Cardio workout')
ON CONFLICT (id) DO NOTHING;

INSERT INTO training_sessions (id, trainer_id, member_id, title, start_time, end_time, status, notes, created_by) VALUES
(1, 1, 1, 'Hypertrophy Upper Body', CURRENT_TIMESTAMP + INTERVAL '2 hours', CURRENT_TIMESTAMP + INTERVAL '3 hours', 'scheduled', 'Focus on bench press bar path and lat engagement', 1),
(2, 2, 2, 'Cardio & Agility Conditioning', CURRENT_TIMESTAMP + INTERVAL '4 hours', CURRENT_TIMESTAMP + INTERVAL '5 hours', 'scheduled', 'Kettlebell swings and plyometrics', 2),
(3, 1, 3, 'Deadlift Technique Check', CURRENT_TIMESTAMP + INTERVAL '1 day', CURRENT_TIMESTAMP + INTERVAL '25 hours', 'scheduled', 'Work up to 80% 1RM', 1),
(4, 3, 5, 'Shoulder Mobility & Core', CURRENT_TIMESTAMP - INTERVAL '1 day', CURRENT_TIMESTAMP - INTERVAL '23 hours', 'completed', 'Client reported reduced impingement pain', 3)
ON CONFLICT (id) DO NOTHING;

INSERT INTO workout_plans (id, name, member_id, trainer_id, goal, schedule, start_date, end_date, status, notes, created_by) VALUES
(1, 'Beginner Strength Foundation (Upper/Lower)', 1, 1, 'Build fundamental compound strength & muscle hypertrophy', 'Mon/Tue/Thu/Fri', '2026-08-15', '2026-11-15', 'active', 'Maintain strict form. Add 2.5kg each week on compound lifts.', 3),
(2, 'Metabolic Burn & Toning', 2, 2, 'Fat loss and functional stamina', 'Mon/Wed/Fri 45 mins', '2026-09-01', '2026-11-30', 'active', 'Keep rest intervals under 45 seconds.', 4)
ON CONFLICT (id) DO NOTHING;

INSERT INTO workout_exercises (id, plan_id, day_label, exercise_name, sets, reps, weight, rest_seconds, notes, sort_order) VALUES
(1, 1, 'Upper Day A', 'Barbell Bench Press', 4, '8-10', '60 kg', 90, 'Pause 1s on chest', 1),
(2, 1, 'Upper Day A', 'Bent-Over Barbell Row', 4, '10', '50 kg', 75, 'Pull to lower chest', 2),
(3, 1, 'Upper Day A', 'Overhead Dumbbell Press', 3, '12', '16 kg', 60, 'Keep core braced', 3),
(4, 1, 'Lower Day B', 'Barbell Back Squat', 4, '6-8', '80 kg', 120, 'Hit parallel depth', 4),
(5, 1, 'Lower Day B', 'Romanian Deadlift', 3, '10', '70 kg', 90, 'Feel hamstring stretch', 5),
(6, 2, 'Full Body Circuit', 'Kettlebell Goblet Squat', 3, '15', '16 kg', 45, 'Explosive drive up', 1),
(7, 2, 'Full Body Circuit', 'Push-ups', 3, '12-15', 'Bodyweight', 45, 'Chest to deck', 2),
(8, 2, 'Full Body Circuit', 'Rowing Machine Intervals', 5, '500m', 'Level 6', 60, 'Target under 2:00 / 500m', 3)
ON CONFLICT (id) DO NOTHING;

INSERT INTO equipment (id, equipment_code, name, category, brand, model, quantity, out_of_service_qty, purchase_date, purchase_price, location, condition, status, maintenance_interval_days, last_maintenance_date, next_maintenance_date, notes) VALUES
(1, 'EQP-000001', 'Commercial Treadmill T-800', 'cardio', 'LifeFitness', 'Integrity Series', 4, 1, '2024-05-10', 480000.00, 'Cardio Zone 1', 'fair', 'under_maintenance', 90, '2026-07-15', '2026-10-13', 'Treadmill #3 motor belt slipping.'),
(2, 'EQP-000002', 'Olympic Barbell & Plates', 'free_weights', 'Rogue Fitness', 'Ohio Bar 20kg + 150kg set', 6, 0, '2024-06-15', 360000.00, 'Free Weight Area', 'excellent', 'available', 180, '2026-05-20', '2026-11-20', 'All bearings smooth.'),
(3, 'EQP-000003', 'Dual Cable Cross Machine', 'strength_machine', 'Hammer Strength', 'Select HD', 2, 0, '2024-08-01', 280000.00, 'Main Floor', 'good', 'available', 120, '2026-06-10', '2026-10-10', 'Cables aligned.'),
(4, 'EQP-000004', 'Adjustable Flat-Incline Benches', 'free_weights', 'Rogue Fitness', 'Adjustable Bench 3.0', 8, 1, '2024-06-10', 200000.00, 'Dumbbell Zone', 'fair', 'damaged', 180, '2026-04-10', '2026-10-10', 'Bench #5 adjustment pin stuck.')
ON CONFLICT (id) DO NOTHING;

INSERT INTO equipment_purchases (id, equipment_id, purchase_date, quantity, unit_cost, supplier, reference, recorded_by) VALUES
(1, 1, '2024-05-10', 4, 120000.00, 'FitPro Equipment Corp', 'INV-2024-8812', 1),
(2, 2, '2024-06-15', 6, 60000.00, 'Rogue Fitness PH', 'INV-2024-9104', 1),
(3, 3, '2024-08-01', 2, 140000.00, 'Hammer Strength Manila', 'INV-2024-9921', 1),
(4, 4, '2024-06-10', 8, 25000.00, 'Rogue Fitness PH', 'INV-2024-9055', 1)
ON CONFLICT (id) DO NOTHING;

INSERT INTO maintenance_records (id, equipment_id, issue_description, maintenance_type, priority, reported_date, scheduled_date, completed_date, technician, cost, status, affected_qty, condition_after, notes, reported_by) VALUES
(1, 1, 'Treadmill #3 motor belt squeaking and slipping past speed 10', 'repair', 'high', '2026-10-10', '2026-10-25', NULL, 'Apex Fitness Mechanics Inc.', 3500.00, 'scheduled', 1, NULL, 'Replacement belt ordered from supplier.', 1),
(2, 4, 'Bench #5 adjustment pin stuck; member unable to change incline safely', 'corrective', 'medium', '2026-10-11', '2026-10-12', '2026-10-12', 'In-house tech Dave', 450.00, 'completed', 1, 'good', 'Cleaned debris and replaced compression spring.', 2)
ON CONFLICT (id) DO NOTHING;

-- Reset sequence IDs
SELECT setval('membership_plans_id_seq', COALESCE((SELECT MAX(id) FROM membership_plans), 1));
SELECT setval('trainers_id_seq', COALESCE((SELECT MAX(id) FROM trainers), 1));
SELECT setval('members_id_seq', COALESCE((SELECT MAX(id) FROM members), 1));
SELECT setval('users_id_seq', COALESCE((SELECT MAX(id) FROM users), 1));
SELECT setval('subscriptions_id_seq', COALESCE((SELECT MAX(id) FROM subscriptions), 1));
SELECT setval('payments_id_seq', COALESCE((SELECT MAX(id) FROM payments), 1));
SELECT setval('attendance_id_seq', COALESCE((SELECT MAX(id) FROM attendance), 1));
SELECT setval('training_sessions_id_seq', COALESCE((SELECT MAX(id) FROM training_sessions), 1));
SELECT setval('workout_plans_id_seq', COALESCE((SELECT MAX(id) FROM workout_plans), 1));
SELECT setval('workout_exercises_id_seq', COALESCE((SELECT MAX(id) FROM workout_exercises), 1));
SELECT setval('equipment_id_seq', COALESCE((SELECT MAX(id) FROM equipment), 1));
SELECT setval('equipment_purchases_id_seq', COALESCE((SELECT MAX(id) FROM equipment_purchases), 1));
SELECT setval('maintenance_records_id_seq', COALESCE((SELECT MAX(id) FROM maintenance_records), 1));
