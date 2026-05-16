import './MetricList.css';

export interface MetricListItem {
  name: string;
  value: number;
  count: number;
}

interface MetricListProps {
  items: MetricListItem[];
  /** Formata o valor principal (ex.: moeda). Se ausente, mostra a contagem. */
  formatValue?: (v: number) => string;
  accent?: string;
}

/** Lista com barra proporcional — categorias, métodos de pagamento, leads. */
export function MetricList({
  items,
  formatValue,
  accent = 'var(--color-primary)',
}: MetricListProps) {
  if (items.length === 0) {
    return <p className="text-soft">Sem dados ainda.</p>;
  }
  const max = Math.max(...items.map((i) => i.value || i.count), 1);

  return (
    <ul className="metric-list">
      {items.map((it) => {
        const base = it.value || it.count;
        const pct = Math.max(4, Math.round((base / max) * 100));
        return (
          <li key={it.name} className="metric-list__row">
            <div className="metric-list__head">
              <span className="metric-list__name">{it.name}</span>
              <span className="metric-list__val">
                {formatValue ? formatValue(it.value) : it.count}
                <small> · {it.count}x</small>
              </span>
            </div>
            <div className="metric-list__track">
              <div
                className="metric-list__bar"
                style={{ width: `${pct}%`, background: accent }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
