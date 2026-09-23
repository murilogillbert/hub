import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@shared/components/Card/Card';
import { Button } from '@shared/components/Button/Button';
import { StatCard } from '@shared/components/StatCard/StatCard';
import { QrCodeCard } from '@shared/components/QrCode/QrCodeCard';
import { QueryState } from '@shared/components/QueryState/QueryState';
import { Icon } from '@shared/components/Icon/Icon';
import { driverAffiliateApi } from '@shared/api/endpoints';
import { SERVER_ORIGIN } from '@shared/api/client';
import { formatCurrency } from '@shared/utils/formatters';
import { useAuth } from '@shared/hooks/useAuth';

/** Programa de afiliação loja↔motorista — só motorista vê (passageiro não).
 * Código único pra digitar no checkout de qualquer loja onde ele é afiliado
 * + um link/QR por loja (pra indicar o catálogo específico dela). */
export function DriverAffiliateCard() {
  const { user } = useAuth();
  const q = useQuery({ queryKey: ['driver-affiliate-program'], queryFn: () => driverAffiliateApi.myProgram() });
  const [copied, setCopied] = useState(false);

  const copyCode = async () => {
    if (!q.data?.affiliateCode) return;
    await navigator.clipboard.writeText(q.data.affiliateCode);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card>
      <h3>
        <Icon name="handshake" size={18} /> Programa de indicação de lojas
      </h3>
      <p className="text-muted" style={{ marginTop: 'var(--space-1)' }}>
        Indique lojas parceiras onde você é afiliado e ganhe comissão em cada
        venda feita com o seu código no checkout.
      </p>

      <QueryState loading={q.isLoading} error={q.error} empty={false}>
        {q.data && (
          <>
            <div className="row" style={{ marginTop: 'var(--space-3)', alignItems: 'center' }}>
              <code style={{ flex: 1, wordBreak: 'break-all' }}>{q.data.affiliateCode}</code>
              <Button onClick={copyCode}>{copied ? 'Copiado!' : 'Copiar código'}</Button>
            </div>

            {q.data.stores.length === 0 ? (
              <p className="text-soft" style={{ marginTop: 'var(--space-3)' }}>
                Nenhuma loja te adicionou como afiliado ainda. Peça pra loja
                te cadastrar na área "Motoristas afiliados" dela.
              </p>
            ) : (
              <div className="stack" style={{ marginTop: 'var(--space-4)', gap: 'var(--space-5)' }}>
                {q.data.stores.map((s) => (
                  <div key={s.id} className="stack">
                    <strong>{s.partnerName}</strong>
                    <div className="row" style={{ gap: 'var(--space-3)' }}>
                      <StatCard label="Comissão" value={`${s.commissionPercent}%`} />
                      <StatCard label="Cliques no link" value={String(s.linkViews)} />
                      <StatCard label="Ganho" value={formatCurrency(s.commissionEarned)} />
                    </div>
                    <QrCodeCard
                      value={`${SERVER_ORIGIN}/r/indicacao/${s.id}`}
                      size={140}
                      label={`Catálogo — ${s.partnerName}`}
                      ownerName={user?.name ?? 'OpenDriverHub'}
                    />
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </QueryState>
    </Card>
  );
}
