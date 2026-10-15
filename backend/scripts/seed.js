import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { config } from '../src/config/env.js';
import { q, one, withTransaction } from '../src/config/db.js';
import { migrate } from './migrate.js';

export async function seed() {
  console.log('Running database migrations first...');
  await migrate({ quiet: true });

  const defaultPassword = process.env.SEED_DEMO_PASSWORD || 'Admin123!';
  const passwordHash = await bcrypt.hash(defaultPassword, config.bcryptRounds);

  console.log('Seeding sample data...');

  await withTransaction(async (conn) => {
    // 1. Gym Settings
    await conn.query(`
      INSERT INTO gym_settings (id, gym_name, address, phone, email, currency, timezone, grace_period_days, checkin_requires_payment, expiring_soon_days, default_session_minutes)
      VALUES (1, 'Titan Iron Gym & Fitness', '123 Fitness Ave, Makati, Metro Manila', '+63 912 345 6789', 'contact@titanirongym.ph', 'PHP', 'Asia/Manila', 3, 1, 7, 60)
      ON DUPLICATE KEY UPDATE
        gym_name = VALUES(gym_name),
        address = VALUES(address),
        phone = VALUES(phone),
        email = VALUES(email),
        currency = VALUES(currency),
        timezone = VALUES(timezone)
    `);

    // Clean existing tables in safe order for reproducible seeding
    const tables = [
      'activity_logs', 'maintenance_records', 'equipment_purchases', 'equipment',
      'workout_logs', 'workout_exercises', 'workout_plans', 'training_sessions',
      'payment_audit', 'payments', 'attendance', 'subscriptions', 'membership_plans',
      'users', 'members', 'trainers'
    ];
    for (const t of tables) {
      await conn.query(`SET FOREIGN_KEY_CHECKS = 0`);
      await conn.query(`TRUNCATE TABLE \`${t}\``);
      await conn.query(`SET FOREIGN_KEY_CHECKS = 1`);
    }

    // 2. Insert Membership Plans
    await conn.query(`
      INSERT INTO membership_plans (id, name, description, duration_value, duration_unit, price, status) VALUES
      (1, 'Daily Pass', 'Single day pass with access to all gym equipment and locker rooms', 1, 'day', 250.00, 'active'),
      (2, 'Weekly Membership', '7 days of unrestricted gym access', 1, 'week', 900.00, 'active'),
      (3, 'Monthly Standard', 'Full monthly gym access + 1 free fitness assessment', 1, 'month', 2200.00, 'active'),
      (4, 'Quarterly Pro', '3 months access with locker privilege and personal trainer consultation', 3, 'month', 5800.00, 'active'),
      (5, 'Annual VIP', '12 months all-access VIP membership, unlimited group classes, 5 guest passes', 1, 'year', 19500.00, 'active')
    `);

    // 3. Insert Trainers
    await conn.query(`
      INSERT INTO trainers (id, trainer_code, full_name, email, phone, specialization, experience_years, availability, status, bio) VALUES
      (1, 'TRN-000001', 'Marcus Vance', 'marcus@titanirongym.ph', '+63 917 111 2233', 'Strength & Hypertrophy', 6, 'Mon-Fri 06:00-14:00', 'active', 'Certified CSCS strength coach with expertise in powerlifting and athletic conditioning.'),
      (2, 'TRN-000002', 'Elena Rostova', 'elena@titanirongym.ph', '+63 917 222 3344', 'HIIT & Functional Fitness', 4, 'Mon-Sat 12:00-20:00', 'active', 'CrossFit Level 2 trainer specializing in weight loss and metabolic conditioning.'),
      (3, 'TRN-000003', 'Dave Bautista', 'dave@titanirongym.ph', '+63 917 333 4455', 'Rehabilitation & Mobility', 8, 'Tue-Sun 08:00-16:00', 'active', 'Former physiotherapist clinic assistant focusing on posture correction and joint mobility.')
    `);

    // 4. Insert Members
    await conn.query(`
      INSERT INTO members (id, member_code, first_name, last_name, email, phone, address, date_of_birth, gender, registration_date, emergency_contact_name, emergency_contact_phone, trainer_id, status) VALUES
      (1, 'MEM-000001', 'Juan', 'Dela Cruz', 'juan@example.com', '+63 920 123 4567', '742 Evergreen St, Quezon City', '1995-04-12', 'male', '2026-01-10', 'Maria Dela Cruz', '+63 920 999 8888', 1, 'active'),
      (2, 'MEM-000002', 'Sarah', 'Jenkins', 'sarah@example.com', '+63 921 234 5678', '12 Bonifacio Ridge, Taguig', '1998-08-23', 'female', '2026-02-01', 'Robert Jenkins', '+63 921 888 7777', 2, 'active'),
      (3, 'MEM-000003', 'Carlos', 'Reyes', 'carlos@example.com', '+63 922 345 6789', '45 Magsaysay Ave, Pasig', '1990-11-05', 'male', '2026-02-15', 'Ana Reyes', '+63 922 777 6666', 1, 'active'),
      (4, 'MEM-000004', 'Maria', 'Santos', 'maria@example.com', '+63 923 456 7890', '88 Buendia Ave, Makati', '2001-02-18', 'female', '2026-03-01', 'Elena Santos', '+63 923 666 5555', NULL, 'active'),
      (5, 'MEM-000005', 'David', 'Lim', 'david@example.com', '+63 924 567 8901', '101 Taft Ave, Manila', '1988-06-30', 'male', '2026-01-05', 'Grace Lim', '+63 924 555 4444', 3, 'active'),
      (6, 'MEM-000006', 'Jessica', 'Alvarez', 'jessica@example.com', '+63 925 678 9012', '14 Ortigas Ave, San Juan', '1996-09-14', 'female', '2026-03-10', 'Paul Alvarez', '+63 925 444 3333', NULL, 'inactive')
    `);

    // 5. Insert Users (Admin, Staff, Trainers, Members)
    await conn.query(`
      INSERT INTO users (id, full_name, email, password_hash, role, member_id, trainer_id, is_active) VALUES
      (1, 'System Administrator', 'admin@titanirongym.ph', ?, 'admin', NULL, NULL, 1),
      (2, 'Front Desk Staff', 'staff@titanirongym.ph', ?, 'staff', NULL, NULL, 1),
      (3, 'Marcus Vance', 'marcus@titanirongym.ph', ?, 'trainer', NULL, 1, 1),
      (4, 'Elena Rostova', 'elena@titanirongym.ph', ?, 'trainer', NULL, 2, 1),
      (5, 'Juan Dela Cruz', 'juan@example.com', ?, 'member', 1, NULL, 1),
      (6, 'Sarah Jenkins', 'sarah@example.com', ?, 'member', 2, NULL, 1)
    `, [passwordHash, passwordHash, passwordHash, passwordHash, passwordHash, passwordHash]);

    // 6. Subscriptions
    await conn.query(`
      INSERT INTO subscriptions (id, member_id, plan_id, start_date, end_date, price, status, payment_status, created_by) VALUES
      (1, 1, 4, '2026-01-10', '2026-04-09', 5800.00, 'active', 'paid', 1),
      (2, 2, 3, '2026-03-01', '2026-03-31', 2200.00, 'active', 'paid', 2),
      (3, 3, 5, '2026-02-15', '2027-02-14', 19500.00, 'active', 'paid', 1),
      (4, 4, 3, '2026-03-01', '2026-03-31', 2200.00, 'active', 'paid', 2),
      (5, 5, 2, '2026-03-10', '2026-03-16', 900.00, 'expired', 'paid', 2),
      (6, 6, 1, '2026-03-10', '2026-03-10', 250.00, 'expired', 'paid', 2)
    `);

    // 7. Payments
    await conn.query(`
      INSERT INTO payments (id, receipt_no, member_id, subscription_id, amount, payment_date, method, reference, status, description, recorded_by) VALUES
      (1, 'REC-2026-000001', 1, 1, 5800.00, '2026-01-10 09:30:00', 'bank_transfer', 'BDO-9823412', 'completed', 'Quarterly Pro Membership', 1),
      (2, 'REC-2026-000002', 2, 2, 2200.00, '2026-03-01 10:15:00', 'e_wallet', 'GCASH-4910294', 'completed', 'Monthly Standard Membership', 2),
      (3, 'REC-2026-000003', 3, 3, 19500.00, '2026-02-15 14:00:00', 'card', 'CARD-TXN-7712', 'completed', 'Annual VIP Membership', 1),
      (4, 'REC-2026-000004', 4, 4, 2200.00, '2026-03-01 16:45:00', 'cash', 'CASH-REC-001', 'completed', 'Monthly Standard Membership', 2),
      (5, 'REC-2026-000005', 5, 5, 900.00, '2026-03-10 11:00:00', 'cash', 'CASH-REC-002', 'completed', 'Weekly Pass', 2),
      (6, 'REC-2026-000006', 6, 6, 250.00, '2026-03-10 17:30:00', 'cash', 'CASH-REC-003', 'completed', 'Daily Pass', 2)
    `);

    // 8. Attendance (Historical + Today checkins)
    await conn.query(`
      INSERT INTO attendance (id, member_id, check_in, check_out, recorded_by, notes) VALUES
      (1, 1, '2026-10-14 06:15:00', '2026-10-14 07:45:00', 2, 'Morning workout'),
      (2, 2, '2026-10-14 12:30:00', '2026-10-14 13:40:00', 2, 'HIIT session'),
      (3, 3, '2026-10-14 17:00:00', '2026-10-14 19:00:00', 2, 'Heavy squat day'),
      (4, 1, '2026-10-15 06:30:00', NULL, 2, 'Still in gym'),
      (5, 4, '2026-10-15 08:00:00', NULL, 2, 'Cardio workout')
    `);

    // 9. Training Sessions
    await conn.query(`
      INSERT INTO training_sessions (id, trainer_id, member_id, title, start_time, end_time, status, notes, created_by) VALUES
      (1, 1, 1, 'Hypertrophy Upper Body', '2026-10-15 09:00:00', '2026-10-15 10:00:00', 'scheduled', 'Focus on bench press bar path and lat engagement', 1),
      (2, 2, 2, 'Cardio & Agility Conditioning', '2026-10-15 14:00:00', '2026-10-15 15:00:00', 'scheduled', 'Kettlebell swings and plyometrics', 2),
      (3, 1, 3, 'Deadlift Technique Check', '2026-10-16 10:00:00', '2026-10-16 11:00:00', 'scheduled', 'Work up to 80% 1RM', 1),
      (4, 3, 5, 'Shoulder Mobility & Core', '2026-10-14 10:00:00', '2026-10-14 11:00:00', 'completed', 'Client reported reduced impingement pain', 3)
    `);

    // 10. Workout Plans & Exercises
    await conn.query(`
      INSERT INTO workout_plans (id, name, member_id, trainer_id, goal, schedule, start_date, end_date, status, notes, created_by) VALUES
      (1, 'Beginner Strength Foundation (Upper/Lower)', 1, 1, 'Build fundamental compound strength & muscle hypertrophy', 'Mon/Tue/Thu/Fri', '2026-01-15', '2026-04-15', 'active', 'Maintain strict form. Add 2.5kg each week on compound lifts.', 3),
      (2, 'Metabolic Burn & Toning', 2, 2, 'Fat loss and functional stamina', 'Mon/Wed/Fri 45 mins', '2026-03-01', '2026-05-30', 'active', 'Keep rest intervals under 45 seconds.', 4)
    `);

    await conn.query(`
      INSERT INTO workout_exercises (id, plan_id, day_label, exercise_name, sets, reps, weight, rest_seconds, notes, sort_order) VALUES
      (1, 1, 'Upper Day A', 'Barbell Bench Press', 4, '8-10', '60 kg', 90, 'Pause 1s on chest', 1),
      (2, 1, 'Upper Day A', 'Bent-Over Barbell Row', 4, '10', '50 kg', 75, 'Pull to lower chest', 2),
      (3, 1, 'Upper Day A', 'Overhead Dumbbell Press', 3, '12', '16 kg', 60, 'Keep core braced', 3),
      (4, 1, 'Lower Day B', 'Barbell Back Squat', 4, '6-8', '80 kg', 120, 'Hit parallel depth', 4),
      (5, 1, 'Lower Day B', 'Romanian Deadlift', 3, '10', '70 kg', 90, 'Feel hamstring stretch', 5),
      (6, 2, 'Full Body Circuit', 'Kettlebell Goblet Squat', 3, '15', '16 kg', 45, 'Explosive drive up', 1),
      (7, 2, 'Full Body Circuit', 'Push-ups', 3, '12-15', 'Bodyweight', 45, 'Chest to deck', 2),
      (8, 2, 'Full Body Circuit', 'Rowing Machine Intervals', 5, '500m', 'Level 6', 60, 'Target under 2:00 / 500m', 3)
    `);

    // 11. Equipment
    await conn.query(`
      INSERT INTO equipment (id, equipment_code, name, category, brand, model, quantity, out_of_service_qty, purchase_date, purchase_price, location, \`condition\`, status, maintenance_interval_days, last_maintenance_date, next_maintenance_date, notes) VALUES
      (1, 'EQP-000001', 'Commercial Treadmill T-800', 'cardio', 'LifeFitness', 'Integrity Series', 4, 1, '2024-05-10', 480000.00, 'Cardio Zone 1', 'fair', 'under_maintenance', 90, '2026-07-15', '2026-10-13', 'Treadmill #3 motor belt slipping under high speeds.'),
      (2, 'EQP-000002', 'Commercial Treadmill T-800', 'cardio', 'LifeFitness', 'Integrity Series', 4, 0, '2024-05-10', 480000.00, 'Cardio Zone 1', 'good', 'available', 90, '2026-08-01', '2026-11-01', 'Units #1, #2, #4 running smooth.'),
      (3, 'EQP-000003', 'Olympic Barbell & Bumper Plate Set', 'free_weights', 'Rogue Fitness', 'Ohio Bar 20kg + 150kg set', 6, 0, '2024-06-15', 360000.00, 'Free Weight Area', 'excellent', 'available', 180, '2026-05-20', '2026-11-20', 'All bearings smooth and sleeves oiled.'),
      (4, 'EQP-000004', 'Dual Cable Cross Machine', 'strength_machine', 'Hammer Strength', 'Select HD', 2, 0, '2024-08-01', 280000.00, 'Main Strength Floor', 'good', 'available', 120, '2026-06-10', '2026-10-10', 'Cables inspected, pulleys aligned.'),
      (5, 'EQP-000005', 'Commercial Rowing Machine', 'cardio', 'Concept2', 'Model D PM5', 3, 0, '2025-01-20', 165000.00, 'Cardio Zone 2', 'good', 'available', 90, '2026-08-15', '2026-11-15', 'Chain tension optimal.'),
      (6, 'EQP-000006', 'Adjustable Flat-Incline Benches', 'free_weights', 'Rogue Fitness', 'Adjustable Bench 3.0', 8, 1, '2024-06-10', 200000.00, 'Dumbbell Zone', 'fair', 'damaged', 180, '2026-04-10', '2026-10-10', 'Bench #5 pin lock slightly bent.'),
      (7, 'EQP-000007', 'Leg Press Machine 45-Degree', 'strength_machine', 'Cybex', 'Plate Loaded 45', 2, 0, '2024-09-01', 220000.00, 'Leg Day Zone', 'excellent', 'available', 180, '2026-07-01', '2027-01-01', 'Pads replaced and guide rails greased.')
    `);

    // 12. Equipment Purchases (for inventory value calculation)
    await conn.query(`
      INSERT INTO equipment_purchases (id, equipment_id, purchase_date, quantity, unit_cost, supplier, reference, recorded_by) VALUES
      (1, 1, '2024-05-10', 4, 120000.00, 'FitPro Equipment Corp', 'INV-2024-8812', 1),
      (2, 3, '2024-06-15', 6, 60000.00, 'Rogue Fitness PH', 'INV-2024-9104', 1),
      (3, 4, '2024-08-01', 2, 140000.00, 'Hammer Strength Manila', 'INV-2024-9921', 1),
      (4, 5, '2025-01-20', 3, 55000.00, 'ActiveLife Distributions', 'INV-2025-1002', 1),
      (5, 6, '2024-06-10', 8, 25000.00, 'Rogue Fitness PH', 'INV-2024-9055', 1),
      (6, 7, '2024-09-01', 2, 110000.00, 'Cybex Commercial PH', 'INV-2024-9403', 1)
    `);

    // 13. Maintenance Records
    await conn.query(`
      INSERT INTO maintenance_records (id, equipment_id, issue_description, maintenance_type, priority, reported_date, scheduled_date, completed_date, technician, cost, status, affected_qty, condition_after, notes, reported_by) VALUES
      (1, 1, 'Treadmill #3 motor belt squeaking and slipping past speed 10', 'repair', 'high', '2026-10-10', '2026-10-16', NULL, 'Apex Fitness Mechanics Inc.', 3500.00, 'scheduled', 1, NULL, 'Replacement belt ordered from supplier.', 1),
      (2, 6, 'Bench #5 adjustment pin stuck; member unable to change incline safely', 'corrective', 'medium', '2026-10-11', '2026-10-12', '2026-10-12', 'In-house tech Dave', 450.00, 'completed', 1, 'good', 'Cleaned debris and replaced compression spring.', 2),
      (3, 4, 'Quarterly cable tension and pulley alignment inspection', 'preventive', 'low', '2026-06-08', '2026-06-10', '2026-06-10', 'Hammer Strength Service', 2800.00, 'completed', 0, 'good', 'All cables within factory tolerance.', 1)
    `);
  });

  console.log('\nSeed completed successfully!');
  console.log('====================================================');
  console.log('Default credentials for testing:');
  console.log(`Password for all demo accounts: ${defaultPassword}`);
  console.log('  Admin:   admin@titanirongym.ph');
  console.log('  Staff:   staff@titanirongym.ph');
  console.log('  Trainer: marcus@titanirongym.ph');
  console.log('  Member:  juan@example.com');
  console.log('====================================================\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  seed().catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
}

