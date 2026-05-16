import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { QrCode } from '@shared/components/QrCode/QrCode';
import { Button } from '@shared/components/Button/Button';
import { Card } from '@shared/components/Card/Card';
import { QueryState } from '@shared/components/QueryState/QueryState';
import { formatCode, formatCurrency, formatDateTime } from '@shared/utils/formatters';
import { copyToClipboard } from '@shared/utils/clipboard';
import { downloadQrPng } from '@shared/utils/downloadQr';
import { ordersApi } from '@shared/api/endpoints';
import { Order } from '@shared/types';
import './ClientArea.css';

export function MyItemsPage() {
  const ordersQuery = useQuery({
    queryKey: ['my-orders'],
    queryFn: () => ordersApi.myOrders(),
  });
  const myOrders = ordersQuery.data ?? [];
  const active = myOrders.filter((o) => o.status === 'paid' || o.status === 'pending');
  const [selected, setSelected] = useState<Order | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!selected && active.length > 0) setSelected(active[0]);
  }, [active, selected]);

  const handleCopy = async () => {
    if (!selected) return;
    const ok = await copyToClipboard(formatCode(selected.code));
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = async () => {
    if (!selected) return;
    const svg = document
      .getElementById(`qr-${selected.id}`)
      ?.querySelector('svg');
    if (svg instanceof SVGSVGElement) {
      await downloadQrPng(svg, `voucher-${selected.code}`);
    }
  };

  return (
    <div className="client-area">
      <header className="client-area__header">
        <div>
          <h2>Meus itens ativos</h2>
          <p className="text-muted">
            Vouchers prontos para resgatar. Clique em um item para ver o QR code.
          </p>
        </div>
        <span className="badge badge-primary">{active.length} ativo(s)</span>
      </header>

      <QueryState
        loading={ordersQuery.isLoading}
        error={ordersQuery.error}
        empty={active.length === 0}
        emptyLabel="Você ainda não tem vouchers ativos. Compre um produto no catálogo."
      >
        <div className="my-items">
          <ul className="my-items__list">
            {active.map((o) => (
              <li
                key={o.id}
                className={`my-items__item ${selected?.id === o.id ? 'is-active' : ''}`}
                onClick={() => setSelected(o)}
              >
                <div>
                  <strong>{o.productTitle}</strong>
                  <small className="text-muted">{o.partnerName}</small>
                </div>
                <div className="my-items__item-meta">
                  <span className={`badge ${o.status === 'paid' ? 'badge-accent' : 'badge-warning'}`}>
                    {o.status === 'paid' ? 'Pronto' : 'Aguardando'}
                  </span>
                  <strong>{formatCurrency(o.paidPrice)}</strong>
                </div>
              </li>
            ))}
          </ul>

          {selected && (
            <Card className="my-items__detail">
              <header className="row-between">
                <div>
                  <h3>{selected.productTitle}</h3>
                  <small className="text-muted">
                    Comprado em {formatDateTime(selected.createdAt)}
                  </small>
                </div>
                <span
                  className={`badge ${selected.status === 'paid' ? 'badge-accent' : 'badge-warning'}`}
                >
                  {selected.status === 'paid' ? 'Voucher liberado' : 'Aguardando pagamento'}
                </span>
              </header>

              <div className="my-items__qr">
                <QrCode
                  id={`qr-${selected.id}`}
                  value={selected.code}
                  size={220}
                  label={formatCode(selected.code)}
                />
              </div>

              <p className="text-muted">
                Apresente o QR ou o código no balcão do parceiro <strong>{selected.partnerName}</strong>{' '}
                para resgatar.
              </p>

              <dl className="my-items__summary">
                <div>
                  <dt>Valor pago</dt>
                  <dd>{formatCurrency(selected.paidPrice)}</dd>
                </div>
                <div>
                  <dt>Cashback a receber</dt>
                  <dd className="text-accent">{formatCurrency(selected.cashbackEarned)}</dd>
                </div>
              </dl>

              <div className="row">
                <Button variant="secondary" onClick={handleCopy}>
                  {copied ? '✓ Código copiado' : 'Copiar código'}
                </Button>
                <Button variant="ghost" onClick={handleDownload}>
                  Baixar QR
                </Button>
              </div>
            </Card>
          )}
        </div>
      </QueryState>
    </div>
  );
}
