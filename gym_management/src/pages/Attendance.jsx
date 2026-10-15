import React, { useEffect, useState } from 'react';
import { LogIn, LogOut, Search, Calendar, Users, AlertCircle } from 'lucide-react';
import { api } from '../services/api';
import { DataTable } from '../components/DataTable';
import { SearchBar } from '../components/SearchBar';
import { StatCard } from '../components/StatCard';
import { Modal } from '../components/Modal';

export function Attendance() {
  const [records, setRecords] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [activeOnly, setActiveOnly] = useState(false);

  // Check-in modal
  const [checkInModalOpen, setCheckInModalOpen] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [memberResults, setMemberResults] = useState([]);
  const [selectedMember, setSelectedMember] = useState(null);
  const [checkInNotes, setCheckInNotes] = useState('');
  const [checkInWarning, setCheckInWarning] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadData = async (page = 1) => {
    setLoading(true);
    try {
      const [att, st] = await Promise.all([
        api.get('/attendance', {
          page,
          limit: 10,
          search,
          date: dateFilter,
          active_only: activeOnly ? 'true' : undefined,
        }),
        api.get('/attendance/stats'),
      ]);
      setRecords(att.data);
      setPagination(att.pagination);
      setStats(st);
    } catch (err) {
      console.error('Failed to load attendance:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(1);
  }, [search, dateFilter, activeOnly]);

  const searchMembers = async (query) => {
    setMemberSearch(query);
    if (!query || query.length < 2) {
      setMemberResults([]);
      return;
    }
    try {
      const res = await api.get('/members', { search: query, limit: 5 });
      setMemberResults(res.data);
    } catch (e) {
      console.warn(e);
    }
  };

  const handleCheckInSubmit = async (e) => {
    e.preventDefault();
    if (!selectedMember) return;
    setSubmitting(true);
    setCheckInWarning('');

    try {
      const res = await api.post('/attendance/check-in', {
        member_id: selectedMember.id,
        notes: checkInNotes,
      });

      if (res.warning) {
        setCheckInWarning(res.warning);
      } else {
        setCheckInModalOpen(false);
        setSelectedMember(null);
        setMemberSearch('');
        setCheckInNotes('');
        loadData(1);
      }
    } catch (err) {
      setCheckInWarning(err.message || 'Check-in failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCheckOut = async (attendanceId) => {
    try {
      await api.post('/attendance/check-out', { attendance_id: attendanceId });
      loadData(pagination.page);
    } catch (err) {
      alert(err.message || 'Check-out failed');
    }
  };

  const columns = [
    {
      header: 'Member',
      render: (a) => (
        <div>
          <strong>{a.first_name} {a.last_name}</strong>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{a.member_code}</div>
        </div>
      ),
    },
    {
      header: 'Check-In Time',
      render: (a) => (
        <div>
          <div>{new Date(a.check_in).toLocaleDateString()}</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {new Date(a.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      ),
    },
    {
      header: 'Check-Out Time',
      render: (a) =>
        a.check_out ? (
          <div>
            <div>{new Date(a.check_out).toLocaleDateString()}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {new Date(a.check_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        ) : (
          <span className="badge badge-success">Currently Inside</span>
        ),
    },
    {
      header: 'Staff Recorder',
      accessor: 'recorded_by_name',
      render: (a) => a.recorded_by_name || 'System',
    },
    {
      header: 'Notes',
      accessor: 'notes',
      render: (a) => a.notes || '—',
    },
    {
      header: 'Actions',
      align: 'right',
      render: (a) =>
        !a.check_out && (
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => handleCheckOut(a.id)}
          >
            <LogOut size={14} />
            <span>Check Out</span>
          </button>
        ),
    },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Attendance Tracking</h1>
          <p className="page-subtitle">Monitor daily gym traffic and member check-in eligibility</p>
        </div>
        <button className="btn btn-primary" onClick={() => setCheckInModalOpen(true)}>
          <LogIn size={16} />
          <span>Member Check-In</span>
        </button>
      </div>

      <div className="grid grid-cols-2" style={{ marginBottom: 20 }}>
        <StatCard
          title="Today's Check-Ins"
          value={stats?.total_today ?? 0}
          icon={Calendar}
          color="#ff6b00"
          subtext={`Date: ${stats?.date || 'Today'}`}
        />
        <StatCard
          title="Currently Inside Facility"
          value={stats?.currently_inside ?? 0}
          icon={Users}
          color="#10b981"
          subtext="Active members working out"
        />
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: 1, minWidth: 260 }}>
            <SearchBar
              value={search}
              onChange={setSearch}
              placeholder="Search member name or code..."
            />
          </div>
          <div>
            <input
              type="date"
              className="form-input"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
            />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.88rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={activeOnly}
              onChange={(e) => setActiveOnly(e.target.checked)}
            />
            Show Currently Inside Only
          </label>
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <DataTable
          columns={columns}
          data={records}
          loading={loading}
          pagination={pagination}
          onPageChange={loadData}
        />
      </div>

      {/* Check-In Modal */}
      <Modal
        isOpen={checkInModalOpen}
        onClose={() => {
          setCheckInModalOpen(false);
          setCheckInWarning('');
          setSelectedMember(null);
        }}
        title="Check-In Member"
      >
        <form onSubmit={handleCheckInSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {checkInWarning && (
            <div style={{ padding: 12, background: '#fef3c7', color: '#92400e', borderRadius: 6, display: 'flex', gap: 8 }}>
              <AlertCircle size={20} style={{ flexShrink: 0 }} />
              <div>
                <strong>Notice:</strong> {checkInWarning}
              </div>
            </div>
          )}

          <div>
            <label className="form-label">Search Member *</label>
            <input
              type="text"
              className="form-input"
              placeholder="Type member name or code..."
              value={memberSearch}
              onChange={(e) => searchMembers(e.target.value)}
            />
            {memberResults.length > 0 && !selectedMember && (
              <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 6, marginTop: 4, maxHeight: 150, overflowY: 'auto' }}>
                {memberResults.map((m) => (
                  <div
                    key={m.id}
                    style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9' }}
                    onClick={() => {
                      setSelectedMember(m);
                      setMemberSearch(`${m.first_name} ${m.last_name} (${m.member_code})`);
                      setMemberResults([]);
                    }}
                  >
                    <strong>{m.first_name} {m.last_name}</strong> — {m.member_code} ({m.status})
                  </div>
                ))}
              </div>
            )}
          </div>

          {selectedMember && (
            <div style={{ padding: 10, background: '#f8fafc', borderRadius: 6, fontSize: '0.85rem' }}>
              <div>Selected: <strong>{selectedMember.first_name} {selectedMember.last_name}</strong></div>
              <div>Plan: {selectedMember.current_plan_name || 'No Active Plan'}</div>
            </div>
          )}

          <div>
            <label className="form-label">Check-In Notes</label>
            <input
              type="text"
              className="form-input"
              placeholder="Optional notes or locker assignment..."
              value={checkInNotes}
              onChange={(e) => setCheckInNotes(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setCheckInModalOpen(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!selectedMember || submitting}
            >
              {submitting ? 'Checking In...' : 'Confirm Check-In'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

