import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  CreditCard,
  CalendarCheck,
  DollarSign,
  UserCheck,
  Dumbbell,
  Package,
  Wrench,
  FileBarChart,
  Settings,
  LogOut,
  Flame,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function Sidebar({ open, onClose }) {
  const { user, logout, isAdmin, isStaff } = useAuth();

  const navItems = [
    { label: 'Dashboard', path: '/', icon: LayoutDashboard, show: true },
    { label: 'Members', path: '/members', icon: Users, show: isStaff || user?.role === 'trainer' },
    { label: 'Membership Plans', path: '/memberships', icon: CreditCard, show: isStaff },
    { label: 'Attendance', path: '/attendance', icon: CalendarCheck, show: isStaff },
    { label: 'Payments', path: '/payments', icon: DollarSign, show: isStaff || user?.role === 'member' },
    { label: 'Trainers', path: '/trainers', icon: UserCheck, show: true },
    { label: 'Workout Plans', path: '/workout-plans', icon: Dumbbell, show: true },
    { label: 'Gym Equipment', path: '/equipment', icon: Package, show: true },
    { label: 'Maintenance', path: '/maintenance', icon: Wrench, show: isStaff },
    { label: 'Reports', path: '/reports', icon: FileBarChart, show: isStaff },
    { label: 'Settings', path: '/settings', icon: Settings, show: isAdmin },
  ];

  return (
    <>
      {open && <div className="sidebar-backdrop" onClick={onClose} />}
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="brand-logo">
            <Flame size={24} color="var(--color-orange)" />
            <span>TITAN IRON</span>
          </div>
        </div>

        <div className="sidebar-user">
          <div className="user-avatar">
            {user?.full_name?.charAt(0) || 'U'}
          </div>
          <div className="user-info">
            <span className="user-name">{user?.full_name}</span>
            <span className="user-role">{user?.role}</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          {navItems
            .filter((item) => item.show)
            .map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === '/'}
                  className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                  onClick={() => {
                    if (window.innerWidth <= 768) onClose();
                  }}
                >
                  <Icon size={18} />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
        </nav>

        <div className="sidebar-footer">
          <button className="nav-item logout-btn" onClick={logout}>
            <LogOut size={18} />
            <span>Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
}

