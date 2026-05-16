import './BarChart.css';

interface BarChartProps {
  data: { label: string; value: number }[];
  formatValue?: (value: number) => string;
  accent?: string;
}

export function BarChart({ data, formatValue, accent = 'var(--color-primary)' }: BarChartProps) {
  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="bar-chart">
      {data.map((d) => {
        const heightPct = (d.value / max) * 100;
        return (
          <div className="bar-chart__col" key={d.label}>
            <div className="bar-chart__bar-wrapper">
              <div
                className="bar-chart__bar"
                style={{ height: `${heightPct}%`, background: accent }}
                title={formatValue ? formatValue(d.value) : String(d.value)}
              >
                <span className="bar-chart__value">
                  {formatValue ? formatValue(d.value) : d.value}
                </span>
              </div>
            </div>
            <span className="bar-chart__label">{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}
