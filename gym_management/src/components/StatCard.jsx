import React from 'react';

export function StatCard({ title, value, icon: Icon, color = 'var(--color-orange)', subtext }) {
  return (
    <div className="card stat-card">
      <div className="stat-card-top">
        <span className="stat-card-title">{title}</span>
        {Icon && (
          <div className="stat-card-icon" style={{ backgroundColor: `${color}18`, color }}>
            <Icon size={20} />
          </div>
        )}
      </div>
      <div className="stat-card-value">{value}</div>
      {subtext && <div className="stat-card-subtext">{subtext}</div>}
    </div>
  );
}

