import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Flame, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.message || 'Failed to sign in. Please verify your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoFill = (demoEmail) => {
    setEmail(demoEmail);
    setPassword('Admin123!');
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <div className="login-brand">
            <Flame size={32} color="var(--color-orange)" />
            <span>TITAN IRON GYM</span>
          </div>
          <p className="login-subtitle">Sign in to your management account</p>
        </div>

        {error && (
          <div className="login-error">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input
              type="email"
              className="form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@titanirongym.ph"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              type="password"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          <button type="submit" className="btn btn-primary login-btn" disabled={loading}>
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>

        <div className="demo-accounts">
          <p className="demo-title">Quick Demo Login (Password: Admin123!)</p>
          <div className="demo-chips">
            <button
              type="button"
              className="demo-chip"
              onClick={() => handleDemoFill('admin@titanirongym.ph')}
            >
              Admin
            </button>
            <button
              type="button"
              className="demo-chip"
              onClick={() => handleDemoFill('staff@titanirongym.ph')}
            >
              Staff
            </button>
            <button
              type="button"
              className="demo-chip"
              onClick={() => handleDemoFill('marcus@titanirongym.ph')}
            >
              Trainer
            </button>
            <button
              type="button"
              className="demo-chip"
              onClick={() => handleDemoFill('juan@example.com')}
            >
              Member
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

