import React, { useEffect, useState } from 'react';
import { DollarSign, Printer, RotateCcw, Search, Filter } from 'lucide-react';
import { api } from '../services/api';
import { DataTable } from '../components/DataTable';
import { SearchBar } from '../components/SearchBar';
import { Modal } from '../components/Modal';
import { useAuth } from '../context/AuthContext';

export function Payments() {
  const [payments, setPayments] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [methodFilter, setMethodFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Receipt modal
  const [receiptData, setReceiptData] = useState(null);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);

  // Refund dialog
  const [refundModalOpen, setRefundModalOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [refundReason, setRefundReason] = useState('');
  const [refunding, setRefunding] = useState(false);

  const { isAdmin } = useAuth();

  const loadPayments = async (page = 1) => {
    setLoading(true);
    try {
      const res = await api.get('/payments', {
        page,
        limit: 10,
        search,
        method: methodFilter,
        status: statusFilter,
      });
      setPayments(res.data);
      setPagination(res.pagination);
    } catch (err) {
      console.error('Failed to load payments:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPayments(1);
  }, [search, methodFilter, statusFilter]);

  const viewReceipt = async (paymentId) => {
    try {
      const data = await api.get(`/payments/${paymentId}/receipt`);
      setReceiptData(data);
      setReceiptModalOpen(true);
    } catch (err) {
      alert(err.message || 'Failed to load receipt');
    }
  };

  const handleRefundSubmit = async (e) => {
    e.preventDefault();
    if (!selectedPayment) return;
    setRefunding(true);

    try {
      await api.post(`/payments/${selectedPayment.id}/refund`, { reason: refundReason });
      setRefundModalOpen(false);
      setSelectedPayment(null);
      setRefundReason('');
      loadPayments(pagination.page);
    } catch (err) {
      alert(err.message || 'Refund failed');
    } finally {
      setRefunding(false);
    }
  };

  const columns = [
    {
      header: 'Receipt #',
      accessor: 'receipt_no',
      render: (p) => <strong>{p.receipt_no}</strong>,
    },
    {
      header: 'Member',
      render: (p) => (
        <div>
          <div>{p.first_name} {p.last_name}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p.member_code}</div>
        </div>
      ),
    },
    {
      header: 'Amount (PHP)',
      accessor: 'amount',
      render: (p) => <strong>PHP {Number(p.amount).toLocaleString()}</strong>,
    },
    {
      header: 'Date & Time',
      render: (p) => new Date(p.payment_date).toLocaleString(),
    },
    {
      header: 'Method',
      accessor: 'method',
      render: (p) => (
        <span className="badge badge-info">{p.method?.replace('_', ' ')}</span>
      ),
    },
    {
      header: 'Reference',
      accessor: 'reference',
      render: (p) => p.reference || '—',
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (p) => (
        <span
          className={`badge badge-${
            p.status === 'completed' ? 'success' : p.status === 'refunded' ? 'danger' : 'warning'
          }`}
        >
          {p.status}
        </span>
      ),
    },
    {
      header: 'Actions',
      align: 'right',
      render: (p) => (
        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
          <button
            className="btn btn-secondary btn-sm"
            title="Print Receipt"
            onClick={() => viewReceipt(p.id)}
          >
            <Printer size={14} />
          </button>
          {isAdmin && p.status === 'completed' && (
            <button
              className="btn btn-secondary btn-sm"
              title="Issue Refund"
              onClick={() => {
                setSelectedPayment(p);
                setRefundModalOpen(true);
              }}
            >
              <RotateCcw size={14} color="var(--status-danger)" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Payment & Revenue Transactions</h1>
          <p className="page-subtitle">Detailed ledger of fees, memberships, refunds, and printable receipts</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: 1, minWidth: 260 }}>
            <SearchBar
              value={search}
              onChange={setSearch}
              placeholder="Search receipt #, member name, or reference..."
            />
          </div>
          <div>
            <select
              className="form-input"
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value)}
            >
              <option value="">All Payment Methods</option>
              <option value="cash">Cash</option>
              <option value="e_wallet">E-Wallet</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="card">Card</option>
            </select>
          </div>
          <div>
            <select
              className="form-input"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="completed">Completed</option>
              <option value="pending">Pending</option>
              <option value="refunded">Refunded</option>
            </select>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <DataTable
          columns={columns}
          data={payments}
          loading={loading}
          pagination={pagination}
          onPageChange={loadPayments}
        />
      </div>

      {/* Printable Receipt Modal (Requirement 8) */}
      <Modal
        isOpen={receiptModalOpen}
        onClose={() => setReceiptModalOpen(false)}
        title="Official Payment Receipt"
        maxWidth={500}
      >
        {receiptData && (
          <div id="printable-receipt" style={{ padding: 10, fontFamily: 'monospace' }}>
            <div style={{ textAlign: 'center', borderBottom: '1px dashed #cbd5e1', paddingBottom: 12 }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>{receiptData.gym?.name}</h2>
              <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{receiptData.gym?.address}</div>
              <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{receiptData.gym?.phone}</div>
            </div>

            <div style={{ margin: '14px 0', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div><strong>Receipt No:</strong> {receiptData.payment?.receipt_no}</div>
              <div><strong>Date:</strong> {new Date(receiptData.payment?.payment_date).toLocaleString()}</div>
              <div><strong>Member:</strong> {receiptData.payment?.first_name} {receiptData.payment?.last_name} ({receiptData.payment?.member_code})</div>
              <div><strong>Method:</strong> {receiptData.payment?.method?.toUpperCase()}</div>
              {receiptData.payment?.reference && <div><strong>Reference:</strong> {receiptData.payment?.reference}</div>}
              <div><strong>Status:</strong> {receiptData.payment?.status?.toUpperCase()}</div>
            </div>

            <div style={{ borderTop: '1px dashed #cbd5e1', borderBottom: '1px dashed #cbd5e1', padding: '10px 0', margin: '12px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1rem', fontWeight: 700 }}>
                <span>TOTAL PAID:</span>
                <span>{receiptData.gym?.currency} {Number(receiptData.payment?.amount).toLocaleString()}</span>
              </div>
            </div>

            <div style={{ textAlign: 'center', fontSize: '0.75rem', color: '#64748b', marginTop: 16 }}>
              {receiptData.gym?.receipt_footer || 'Thank you for choosing us for your fitness journey!'}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
              <button className="btn btn-secondary" onClick={() => setReceiptModalOpen(false)}>Close</button>
              <button className="btn btn-primary" onClick={() => window.print()}>
                <Printer size={16} />
                <span>Print</span>
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Refund Modal */}
      <Modal
        isOpen={refundModalOpen}
        onClose={() => setRefundModalOpen(false)}
        title={`Process Refund: ${selectedPayment?.receipt_no}`}
      >
        <form onSubmit={handleRefundSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            You are about to issue a refund of <strong>PHP {Number(selectedPayment?.amount).toLocaleString()}</strong> to member{' '}
            <strong>{selectedPayment?.first_name} {selectedPayment?.last_name}</strong>.
          </p>

          <div>
            <label className="form-label">Reason for Refund *</label>
            <textarea
              className="form-input"
              rows={3}
              value={refundReason}
              onChange={(e) => setRefundReason(e.target.value)}
              placeholder="e.g. Member relocation, billing discrepancy, duplicate payment..."
              required
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
            <button type="button" className="btn btn-secondary" onClick={() => setRefundModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-danger" disabled={refunding}>
              {refunding ? 'Processing...' : 'Confirm Refund'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

