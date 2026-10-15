import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';

import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Members } from './pages/Members';
import { MemberDetails } from './pages/MemberDetails';
import { Memberships } from './pages/Memberships';
import { Attendance } from './pages/Attendance';
import { Payments } from './pages/Payments';
import { Trainers } from './pages/Trainers';
import { WorkoutPlans } from './pages/WorkoutPlans';
import { Equipment } from './pages/Equipment';
import { Maintenance } from './pages/Maintenance';
import { Reports } from './pages/Reports';
import { Settings } from './pages/Settings';

import './App.css';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<Dashboard />} />
            <Route
              path="/members"
              element={
                <ProtectedRoute allowedRoles={['admin', 'staff', 'trainer']}>
                  <Members />
                </ProtectedRoute>
              }
            />
            <Route path="/members/:id" element={<MemberDetails />} />
            <Route
              path="/memberships"
              element={
                <ProtectedRoute allowedRoles={['admin', 'staff']}>
                  <Memberships />
                </ProtectedRoute>
              }
            />
            <Route
              path="/attendance"
              element={
                <ProtectedRoute allowedRoles={['admin', 'staff']}>
                  <Attendance />
                </ProtectedRoute>
              }
            />
            <Route path="/payments" element={<Payments />} />
            <Route path="/trainers" element={<Trainers />} />
            <Route path="/workout-plans" element={<WorkoutPlans />} />
            <Route path="/equipment" element={<Equipment />} />
            <Route
              path="/maintenance"
              element={
                <ProtectedRoute allowedRoles={['admin', 'staff']}>
                  <Maintenance />
                </ProtectedRoute>
              }
            />
            <Route
              path="/reports"
              element={
                <ProtectedRoute allowedRoles={['admin', 'staff']}>
                  <Reports />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <Settings />
                </ProtectedRoute>
              }
            />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
