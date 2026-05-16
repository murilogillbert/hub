import { ReactNode } from 'react';
import './StatCard.css';

interface StatCardProps {
  label: string;
  value: string;
  hint?: string;
  trend?: { value: string; positive?: boolean };
  icon?: ReactNode;
}

export function StatCard({ label, value, hint, trend, icon }: StatCardProps) {
  return (
    <div className="stat-card">
      <div className="stat-card__top">
        <span className="stat-card__label">{label}</span>
        {icon && <span className="stat-card__icon">{icon}</span>}
      </div>
      <strong className="stat-card__value">{value}</strong>
      <div className="stat-card__footer">
        {trend && (
          <span
            className={`stat-card__trend ${
              trend.positive ? 'stat-card__trend--up' : 'stat-card__trend--down'
            }`}
          >
            {trend.positive ? '▲' : '▼'} {trend.value}
          </span>
        )}
        {hint && <span className="stat-card__hint">{hint}</span>}
      </div>
    </div>
  );
}
