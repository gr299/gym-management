import { Router } from 'express';
import { authenticate, authorize, ROLES, MANAGERS } from '../middleware/auth.js';

import * as auth from '../controllers/authController.js';
import * as dashboard from '../controllers/dashboardController.js';
import * as members from '../controllers/membersController.js';
import * as memberships from '../controllers/membershipsController.js';
import * as attendance from '../controllers/attendanceController.js';
import * as payments from '../controllers/paymentsController.js';
import * as trainers from '../controllers/trainersController.js';
import * as workoutPlans from '../controllers/workoutPlansController.js';
import * as equipment from '../controllers/equipmentController.js';
import * as maintenance from '../controllers/maintenanceController.js';
import * as reports from '../controllers/reportsController.js';
import * as settings from '../controllers/settingsController.js';

const router = Router();

// 1. Auth routes (public + current user profile)
router.post('/auth/login', auth.login);
router.post('/auth/logout', authenticate, auth.logout);
router.get('/auth/me', authenticate, auth.me);
router.put('/auth/profile', authenticate, auth.updateProfile);
router.put('/auth/change-password', authenticate, auth.changePassword);

// 2. Dashboard
router.get('/dashboard', authenticate, dashboard.getDashboardData);

// 3. Member Management
router.get('/members', authenticate, authorize(ROLES.ADMIN, ROLES.STAFF, ROLES.TRAINER), members.listMembers);
router.post('/members', authenticate, authorize(...MANAGERS), members.createMember);
router.get('/members/:id', authenticate, members.getMember);
router.put('/members/:id', authenticate, authorize(...MANAGERS), members.updateMember);
router.delete('/members/:id', authenticate, authorize(...MANAGERS), members.deleteMember);
router.get('/members/:id/history', authenticate, members.getMemberHistory);

// 4. Membership Plans & Subscriptions
router.get('/membership-plans', authenticate, memberships.listPlans);
router.post('/membership-plans', authenticate, authorize(ROLES.ADMIN), memberships.createPlan);
router.put('/membership-plans/:id', authenticate, authorize(ROLES.ADMIN), memberships.updatePlan);

router.get('/subscriptions', authenticate, authorize(...MANAGERS), memberships.listSubscriptions);
router.post('/subscriptions', authenticate, authorize(...MANAGERS), memberships.createSubscription);
router.post('/subscriptions/:id/renew', authenticate, authorize(...MANAGERS), memberships.renewSubscription);
router.post('/subscriptions/:id/cancel', authenticate, authorize(...MANAGERS), memberships.cancelSubscription);

// 5. Attendance Management
router.get('/attendance', authenticate, authorize(...MANAGERS), attendance.listAttendance);
router.get('/attendance/stats', authenticate, authorize(...MANAGERS), attendance.getAttendanceStats);
router.post('/attendance/check-in', authenticate, authorize(...MANAGERS), attendance.checkIn);
router.post('/attendance/check-out', authenticate, authorize(...MANAGERS), attendance.checkOut);

// 6. Payment Management
router.get('/payments', authenticate, payments.listPayments);
router.post('/payments', authenticate, authorize(...MANAGERS), payments.createPayment);
router.post('/payments/:id/refund', authenticate, authorize(ROLES.ADMIN), payments.refundPayment);
router.get('/payments/:id/receipt', authenticate, payments.getReceipt);

// 7. Trainer Management & Session Scheduling
router.get('/trainers', authenticate, trainers.listTrainers);
router.get('/trainers/:id', authenticate, trainers.getTrainer);
router.post('/trainers', authenticate, authorize(ROLES.ADMIN), trainers.createTrainer);
router.put('/trainers/:id', authenticate, authorize(ROLES.ADMIN), trainers.updateTrainer);

router.get('/training-sessions', authenticate, trainers.listSessions);
router.post('/training-sessions', authenticate, authorize(ROLES.ADMIN, ROLES.STAFF, ROLES.TRAINER), trainers.createSession);
router.patch('/training-sessions/:id/status', authenticate, trainers.updateSessionStatus);

// 8. Workout Plan Management
router.get('/workout-plans', authenticate, workoutPlans.listWorkoutPlans);
router.get('/workout-plans/:id', authenticate, workoutPlans.getWorkoutPlan);
router.post('/workout-plans', authenticate, authorize(ROLES.ADMIN, ROLES.TRAINER), workoutPlans.createWorkoutPlan);
router.put('/workout-plans/:id', authenticate, authorize(ROLES.ADMIN, ROLES.TRAINER), workoutPlans.updateWorkoutPlan);
router.post('/workout-plans/:id/complete', authenticate, workoutPlans.logWorkoutCompletion);

// 9. Gym Equipment Management
router.get('/equipment', authenticate, equipment.listEquipment);
router.get('/equipment/stats', authenticate, equipment.getEquipmentStats);
router.get('/equipment/:id', authenticate, equipment.getEquipment);
router.post('/equipment', authenticate, authorize(ROLES.ADMIN, ROLES.STAFF), equipment.createEquipment);
router.put('/equipment/:id', authenticate, authorize(ROLES.ADMIN, ROLES.STAFF), equipment.updateEquipment);
router.delete('/equipment/:id', authenticate, authorize(ROLES.ADMIN), equipment.deleteEquipment);

// 10. Maintenance Management
router.get('/maintenance', authenticate, maintenance.listMaintenance);
router.post('/maintenance', authenticate, authorize(ROLES.ADMIN, ROLES.STAFF), maintenance.createMaintenance);
router.patch('/maintenance/:id/complete', authenticate, authorize(ROLES.ADMIN, ROLES.STAFF), maintenance.completeMaintenance);

// 11. Reports
router.get('/reports', authenticate, authorize(ROLES.ADMIN, ROLES.STAFF), reports.getReports);

// 12. Settings & Users
router.get('/settings', authenticate, settings.getGymSettings);
router.put('/settings', authenticate, authorize(ROLES.ADMIN), settings.updateGymSettings);

router.get('/users', authenticate, authorize(ROLES.ADMIN), settings.listUsers);
router.post('/users', authenticate, authorize(ROLES.ADMIN), settings.createUser);
router.put('/users/:id', authenticate, authorize(ROLES.ADMIN), settings.updateUser);

export default router;

