-- Sample Seed Data for Supabase (Titan Iron Gym)
-- Demo password for all accounts: Admin123!
-- bcrypt hash: $2a$10$w3r9f6T4zB9aN3G2sY8VTeG0YqK5cE3wQzG0F9d8uL2hP1jK4xY6m

INSERT INTO membership_plans (id, name, description, duration_value, duration_unit, price, status) VALUES
(1, 'Daily Pass', 'Single day pass with access to all gym equipment and locker rooms', 1, 'day', 250.00, 'active'),
(2, 'Weekly Membership', '7 days of unrestricted gym access', 1, 'week', 900.00, 'active'),
(3, 'Monthly Standard', 'Full monthly gym access + 1 free fitness assessment', 1, 'month', 2200.00, 'active'),
(4, 'Quarterly Pro', '3 months access with locker privilege and personal trainer consultation', 3, 'month', 5800.00, 'active'),
(5, 'Annual VIP', '12 months all-access VIP membership, unlimited group classes, 5 guest passes', 1, 'year', 19500.00, 'active')
ON CONFLICT (id) DO NOTHING;

INSERT INTO trainers (id, trainer_code, full_name, email, phone, specialization, experience_years, availability, status, bio) VALUES
(1, 'TRN-000001', 'Marcus Vance', 'marcus@titanirongym.ph', '+63 917 111 2233', 'Strength & Hypertrophy', 6, 'Mon-Fri 06:00-14:00', 'active', 'Certified CSCS strength coach with expertise in powerlifting and athletic conditioning.'),
(2, 'TRN-000002', 'Elena Rostova', 'elena@titanirongym.ph', '+63 917 222 3344', 'HIIT & Functional Fitness', 4, 'Mon-Sat 12:00-20:00', 'active', 'CrossFit Level 2 trainer specializing in weight loss and metabolic conditioning.'),
(3, 'TRN-000003', 'Dave Bautista', 'dave@titanirongym.ph', '+63 917 333 4455', 'Rehabilitation & Mobility', 8, 'Tue-Sun 08:00-16:00', 'active', 'Former physiotherapist clinic assistant focusing on posture correction and joint mobility.')
ON CONFLICT (id) DO NOTHING;

INSERT INTO members (id, member_code, first_name, last_name, email, phone, address, date_of_birth, gender, registration_date, emergency_contact_name, emergency_contact_phone, trainer_id, status) VALUES
(1, 'MEM-000001', 'Juan', 'Dela Cruz', 'juan@example.com', '+63 920 123 4567', '742 Evergreen St, Quezon City', '1995-04-12', 'male', '2026-01-10', 'Maria Dela Cruz', '+63 920 999 8888', 1, 'active'),
(2, 'MEM-000002', 'Sarah', 'Jenkins', 'sarah@example.com', '+63 921 234 5678', '12 Bonifacio Ridge, Taguig', '1998-08-23', 'female', '2026-02-01', 'Robert Jenkins', '+63 921 888 7777', 2, 'active'),
(3, 'MEM-000003', 'Carlos', 'Reyes', 'carlos@example.com', '+63 922 345 6789', '45 Magsaysay Ave, Pasig', '1990-11-05', 'male', '2026-02-15', 'Ana Reyes', '+63 922 777 6666', 1, 'active'),
(4, 'MEM-000004', 'Maria', 'Santos', 'maria@example.com', '+63 923 456 7890', '88 Buendia Ave, Makati', '2001-02-18', 'female', '2026-03-01', 'Elena Santos', '+63 923 666 5555', NULL, 'active')
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, full_name, email, password_hash, role, member_id, trainer_id, is_active) VALUES
(1, 'System Administrator', 'admin@titanirongym.ph', '$2a$10$tZslG7sC5n9gHk2Qe3u3IOG9lYt3K8u.9g/e7b9e6w5r0t1y2u3i.', 'admin', NULL, NULL, TRUE),
(2, 'Front Desk Staff', 'staff@titanirongym.ph', '$2a$10$tZslG7sC5n9gHk2Qe3u3IOG9lYt3K8u.9g/e7b9e6w5r0t1y2u3i.', 'staff', NULL, NULL, TRUE),
(3, 'Marcus Vance', 'marcus@titanirongym.ph', '$2a$10$tZslG7sC5n9gHk2Qe3u3IOG9lYt3K8u.9g/e7b9e6w5r0t1y2u3i.', 'trainer', NULL, 1, TRUE),
(4, 'Elena Rostova', 'elena@titanirongym.ph', '$2a$10$tZslG7sC5n9gHk2Qe3u3IOG9lYt3K8u.9g/e7b9e6w5r0t1y2u3i.', 'trainer', NULL, 2, TRUE),
(5, 'Juan Dela Cruz', 'juan@example.com', '$2a$10$tZslG7sC5n9gHk2Qe3u3IOG9lYt3K8u.9g/e7b9e6w5r0t1y2u3i.', 'member', 1, NULL, TRUE),
(6, 'Sarah Jenkins', 'sarah@example.com', '$2a$10$tZslG7sC5n9gHk2Qe3u3IOG9lYt3K8u.9g/e7b9e6w5r0t1y2u3i.', 'member', 2, NULL, TRUE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO subscriptions (id, member_id, plan_id, start_date, end_date, price, status, payment_status, created_by) VALUES
(1, 1, 4, '2026-01-10', '2026-04-09', 5800.00, 'active', 'paid', 1),
(2, 2, 3, '2026-03-01', '2026-03-31', 2200.00, 'active', 'paid', 2),
(3, 3, 5, '2026-02-15', '2027-02-14', 19500.00, 'active', 'paid', 1),
(4, 4, 3, '2026-03-01', '2026-03-31', 2200.00, 'active', 'paid', 2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO payments (id, receipt_no, member_id, subscription_id, amount, payment_date, method, reference, status, description, recorded_by) VALUES
(1, 'REC-2026-000001', 1, 1, 5800.00, CURRENT_TIMESTAMP - INTERVAL '30 days', 'bank_transfer', 'BDO-9823412', 'completed', 'Quarterly Pro Membership', 1),
(2, 'REC-2026-000002', 2, 2, 2200.00, CURRENT_TIMESTAMP - INTERVAL '15 days', 'e_wallet', 'GCASH-4910294', 'completed', 'Monthly Standard Membership', 2),
(3, 'REC-2026-000003', 3, 3, 19500.00, CURRENT_TIMESTAMP - INTERVAL '20 days', 'card', 'CARD-TXN-7712', 'completed', 'Annual VIP Membership', 1),
(4, 'REC-2026-000004', 4, 4, 2200.00, CURRENT_TIMESTAMP - INTERVAL '10 days', 'cash', 'CASH-REC-001', 'completed', 'Monthly Standard Membership', 2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO equipment (id, equipment_code, name, category, brand, model, quantity, out_of_service_qty, purchase_date, purchase_price, location, condition, status, maintenance_interval_days, last_maintenance_date, next_maintenance_date, notes) VALUES
(1, 'EQP-000001', 'Commercial Treadmill T-800', 'cardio', 'LifeFitness', 'Integrity Series', 4, 1, '2024-05-10', 480000.00, 'Cardio Zone 1', 'fair', 'under_maintenance', 90, '2026-07-15', '2026-10-13', 'Treadmill #3 motor belt slipping.'),
(2, 'EQP-000002', 'Olympic Barbell & Plates', 'free_weights', 'Rogue Fitness', 'Ohio Bar 20kg + 150kg set', 6, 0, '2024-06-15', 360000.00, 'Free Weight Area', 'excellent', 'available', 180, '2026-05-20', '2026-11-20', 'All bearings smooth.'),
(3, 'EQP-000003', 'Dual Cable Cross Machine', 'strength_machine', 'Hammer Strength', 'Select HD', 2, 0, '2024-08-01', 280000.00, 'Main Floor', 'good', 'available', 120, '2026-06-10', '2026-10-10', 'Cables aligned.'),
(4, 'EQP-000004', 'Adjustable Flat-Incline Benches', 'free_weights', 'Rogue Fitness', 'Adjustable Bench 3.0', 8, 1, '2024-06-10', 200000.00, 'Dumbbell Zone', 'fair', 'damaged', 180, '2026-04-10', '2026-10-10', 'Bench #5 adjustment pin stuck.')
ON CONFLICT (id) DO NOTHING;

-- Reset sequence IDs
SELECT setval('membership_plans_id_seq', (SELECT MAX(id) FROM membership_plans));
SELECT setval('trainers_id_seq', (SELECT MAX(id) FROM trainers));
SELECT setval('members_id_seq', (SELECT MAX(id) FROM members));
SELECT setval('users_id_seq', (SELECT MAX(id) FROM users));
SELECT setval('subscriptions_id_seq', (SELECT MAX(id) FROM subscriptions));
SELECT setval('payments_id_seq', (SELECT MAX(id) FROM payments));
SELECT setval('equipment_id_seq', (SELECT MAX(id) FROM equipment));

