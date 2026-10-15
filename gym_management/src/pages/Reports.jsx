import React, { useEffect, useState } from 'react';
import { Download, Printer, Filter, FileBarChart } from 'lucide-react';
import { api } from '../services/api';

export function Reports() {
  const [reportType, setReportType] = useState('revenue');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [reportResult, setReportResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const res = await api.get('/reports', {
        type: reportType,
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
      });
      setReportResult(res);
    } catch (err) {
      alert(err.message || 'Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [reportType]);

  const handleExportCsv = () => {
    const params = new URLSearchParams({
      type: reportType,
      format: 'csv',
    });
    if (fromDate) params.append('from_date', fromDate);
    if (toDate) params.append('to_date', toDate);

    window.open(`/api/reports?${params.toString()}`, '_blank');
  };

  const rows = reportResult?.data || [];
  const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Operations & Financial Reports</h1>
          <p className="page-subtitle">Exportable analytics across members, revenue, attendance, and equipment</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" onClick={() => window.print()}>
            <Printer size={16} />
            <span>Print Report</span>
          </button>
          <button className="btn btn-primary" onClick={handleExportCsv}>
            <Download size={16} />
            <span>Export to CSV</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <div>
            <label className="form-label" style={{ marginBottom: 4 }}>Report Category</label>
            <select
              className="form-input"
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
            >
              <option value="revenue">Monthly Revenue Summary</option>
              <option value="members">Member Registrations</option>
              <option value="subscriptions">Active & Expired Subscriptions</option>
              <option value="attendance">Attendance Records</option>
              <option value="payments">Detailed Payment Ledger</option>
              <option value="equipment">Equipment Inventory Valuation</option>
              <option value="maintenance">Maintenance & Repair Expenses</option>
            </select>
          </div>

          <div>
            <label className="form-label" style={{ marginBottom: 4 }}>From Date</label>
            <input
              type="date"
              className="form-input"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>

          <div>
            <label className="form-label" style={{ marginBottom: 4 }}>To Date</label>
            <input
              type="date"
              className="form-input"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>

          <div style={{ marginTop: 'auto' }}>
            <button className="btn btn-primary" onClick={fetchReport} disabled={loading}>
              <Filter size={16} />
              <span>Apply Filters</span>
            </button>
          </div>
        </div>
      </div>

      {/* Report Result Preview Card */}
      <div className="card" id="printable-report" style={{ padding: 0 }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 className="card-title">{reportResult?.title || 'Report Results'}</h3>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Total Rows: <strong>{rows.length}</strong>
          </span>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center' }}>Generating report data...</div>
        ) : rows.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
            No records match the selected date range.
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  {columns.map((col, idx) => (
                    <th key={idx} style={{ textTransform: 'capitalize' }}>
                      {col.replace(/_/g, ' ')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rIdx) => (
                  <tr key={rIdx}>
                    {columns.map((col, cIdx) => (
                      <td key={cIdx}>
                        {row[col] != null ? String(row[col]) : '—'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

