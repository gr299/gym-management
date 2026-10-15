import React from 'react';
import { Menu, Bell } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function Navbar({ onToggleSidebar }) {
  const { user } = useAuth();

  return (
    <header className="navbar">
      <div className="navbar-left">
        <button className="menu-btn" onClick={onToggleSidebar} aria-label="Toggle menu">
          <Menu size={20} />
        </button>
        <span className="navbar-title">Titan Iron Gym System</span>
      </div>

      <div className="navbar-right">
        <div className="user-badge">
          <span className="user-role-tag">{user?.role}</span>
          <span className="user-greeting">Hi, {user?.full_name?.split(' ')[0]}</span>
        </div>
      </div>
    </header>
  );
}

