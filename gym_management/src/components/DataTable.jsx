import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export function DataTable({
  columns,
  data,
  loading = false,
  emptyMessage = 'No records found.',
  pagination,
  onPageChange,
}) {
  if (loading) {
    return (
      <div className="table-loading">
        <div className="spinner" />
        <span>Loading data...</span>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return <div className="table-empty">{emptyMessage}</div>;
  }

  return (
    <div className="table-responsive">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((col, idx) => (
              <th key={idx} style={{ textAlign: col.align || 'left', width: col.width }}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rIdx) => (
            <tr key={row.id || rIdx}>
              {columns.map((col, cIdx) => (
                <td key={cIdx} style={{ textAlign: col.align || 'left' }}>
                  {col.render ? col.render(row) : row[col.accessor]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {pagination && pagination.totalPages > 1 && (
        <div className="table-pagination">
          <span className="pagination-info">
            Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
          </span>
          <div className="pagination-actions">
            <button
              className="btn btn-secondary btn-sm"
              disabled={pagination.page <= 1}
              onClick={() => onPageChange(pagination.page - 1)}
            >
              <ChevronLeft size={16} />
            </button>
            <button
              className="btn btn-secondary btn-sm"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => onPageChange(pagination.page + 1)}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

