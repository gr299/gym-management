# Titan Iron Gym — Full-Stack Gym Management System

A complete, production-ready, full-stack Gym Management System built with **React**, **Node.js**, **Express.js**, and **MySQL/MariaDB**.

---

## 🏋️ Features & Modules

1. **Operations Dashboard**
   - 8 live KPI summary cards: Total Members, Active Members, Expired Memberships, Today's Attendance, Total Trainers, Total Equipment, Maintenance Needed, and Monthly Revenue.
   - Interactive charts built with **Recharts**: Revenue Trend, Attendance Trends (last 7 days), Membership Distribution, and Equipment Condition Breakdown.
   - 4 live recent activity feeds: Recent Registrations, Recent Transactions, Latest Check-Ins, and Overdue Maintenance Alerts.

2. **Member Management**
   - Complete CRUD operations (Create, Read, Update, Safe Archive).
   - Instant search by code (`MEM-000001`), name, or email, with status filtering.
   - Detailed member profiles displaying full subscription history, payment transaction log, and attendance records.
   - Safe soft-archival that preserves historical attendance and payment audit trails.

3. **Membership Plans & Subscriptions**
   - Configurable pricing plans (Daily Pass, Weekly, Monthly, Quarterly Pro, Annual VIP).
   - Precise expiration date calculation clamping to target month bounds.
   - One-click renewals and cancellation flows.

4. **Attendance Management**
   - Fast member check-in search with eligibility & unpaid status alerts.
   - Duplicate active check-in prevention.
   - Check-out logging with live tracking of members currently inside the facility.
   - Timezone-aware date calculations (`Asia/Manila` default).

5. **Payments & Revenue Ledger**
   - Record payments via Cash, Bank Transfer, E-Wallet (GCash / Maya), or Credit Card.
   - Automatic subscription `payment_status` synchronization.
   - Idempotency key protection preventing duplicate submissions.
   - Printable official thermal/standard receipts with gym header and footer.
   - Refund workflow with comprehensive audit logging (`payment_audit` table).

6. **Trainer Management & Scheduling**
   - Trainer profiles with specialties, experience, and member roster.
   - Session scheduling with automated time collision and booking conflict detection.
   - Status tracking (`scheduled`, `completed`, `cancelled`, `no_show`).

7. **Workout Plans & Routines**
   - Prescribe custom training splits with sets, target reps, weights, and rest intervals.
   - Daily workout logging for members to track completed routines.

8. **Gym Equipment & Machine Inventory**
   - Comprehensive equipment cataloging (Cardio, Free Weights, Strength Machines, Functional).
   - Tracking condition (`excellent`, `good`, `fair`, `poor`, `damaged`) and out-of-service quantities.
   - Total inventory valuation calculation based on verified purchase entries.
   - Direct trigger to report equipment breakdowns.

9. **Equipment Maintenance Management**
   - Work order logging with priority (`low`, `medium`, `high`, `critical`).
   - Automated machine condition restoration and availability sync upon repair completion.
   - Auto-scheduling of next preventive maintenance based on interval days.

10. **Reports & Data Export**
    - Dynamic reports for Revenue, Registrations, Subscriptions, Attendance, Ledger, Inventory, and Maintenance Expenses.
    - One-click CSV export and printable report layout.

11. **Settings & Role-Based Access Control**
    - Configurable gym branding, currency (default `PHP`), timezone, grace periods, and check-in policies.
    - 4 distinct user roles: `admin`, `staff`, `trainer`, `member`.
    - Secure password changes, token version revocation, and staff account management.

---

## 🛠️ Technology Stack

- **Frontend**: React 19, React Router v7, Lucide Icons, Recharts, Vite
- **Backend**: Node.js (ESM), Express.js 5, Helmet, CORS, Cookie-Parser, Express-Rate-Limit
- **Database**: MySQL / MariaDB (XAMPP compatible), `mysql2` connection pooling
- **Security**: JWT authentication (HTTP-only cookie + Bearer header for API testing), bcryptjs password hashing

---

## 🚀 Quick Setup & Installation

### 1. Prerequisites
- **Node.js** v18+
- **MySQL / MariaDB** (e.g. running via XAMPP on port 3306)

### 2. Configure Backend
Navigate to the `backend/` folder:
```bash
cd backend
npm install
```

Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Ensure your database credentials in `.env` match your local MySQL configuration:
```env
PORT=5000
CLIENT_ORIGIN=http://localhost:5173
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=gym_ms
JWT_SECRET=your_super_secret_random_key_min_32_chars
BCRYPT_ROUNDS=10
```

### 3. Run Database Migrations & Seed Data
Execute database schema migrations and seed realistic demo data:
```bash
npm run migrate
npm run seed
```

*(Optional) Create an independent custom Administrator account interactively:*
```bash
npm run create-admin
```

### 4. Run Automated Business Logic Tests
```bash
npm test
```

### 5. Configure & Build Frontend
Open another terminal and navigate to `gym_management/`:
```bash
cd gym_management
npm install
npm run build
```

---

## 💻 Running the Application

### Start Backend API Server (Port 5000):
```bash
cd backend
npm start
# or npm run dev (with hot-reload)
```

### Start Frontend Vite Dev Server (Port 5173):
```bash
cd gym_management
npm run dev
```

Open your browser at: **`http://localhost:5173`**

---

## 🔑 Demo Login Credentials

All demo accounts are pre-seeded with the password: **`Admin123!`**

| Role | Email | Permissions |
| :--- | :--- | :--- |
| **Admin** | `admin@titanirongym.ph` | Full access to all modules, financial refunds, user creation, and gym settings. |
| **Staff** | `staff@titanirongym.ph` | Manage members, check-ins, record payments, and equipment inventory. |
| **Trainer** | `marcus@titanirongym.ph` | View assigned members, manage workout routines, and schedule coaching sessions. |
| **Member** | `juan@example.com` | View personal profile, subscription status, payment history, and assigned workouts. |

*(The login screen also provides convenient one-click demo login buttons for rapid testing).*

---

## 🧪 API Verification & Testing

Verify health and basic endpoints via `curl` or PowerShell:
```bash
# Health check
curl http://localhost:5000/api/health

# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@titanirongym.ph","password":"Admin123!"}'
```

