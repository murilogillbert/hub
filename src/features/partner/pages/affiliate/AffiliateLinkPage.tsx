import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@shared/components/Card/Card';
import { Button } from '@shared/components/Button/Button';
import { StatCard } from '@shared/components/StatCard/StatCard';
import { QueryState } from '@shared/components/QueryState/QueryState';
import { affiliateApi } from '@shared/api/endpoints';
import { SERVER_ORIGIN } from '@shared/api/client';
import '../PartnerPages.css';

export function AffiliateLinkPage() {
  const q = useQuery({ queryKey: ['affiliate-link'], queryFn: () => affiliateApi.link() });
  const [copied, setCopied] = useState(false);

  const link = q.data?.code ? `${SERVER_ORIGIN}/r/${q.data.code}` : '';

  const copy = async () => {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="partner-page">
      <header className="partner-page__header">
        <div>
          <h2>Meu link de indicação</h2>
          <p className="text-muted">
            Envie este link para quem quiser fazer um orçamento de energia
            solar — as visitas e cotações geradas por ele ficam contadas aqui.
          </p>
        </div>
      </header>

      <QueryState loading={q.isLoading} error={q.error} empty={false}>
        <Card>
          <div className="row">
            <code style={{ flex: 1, wordBreak: 'break-all' }}>{link || 'Link ainda não disponível.'}</code>
            <Button onClick={copy} disabled={!link}>
              {copied ? 'Copiado!' : 'Copiar link'}
            </Button>
          </div>
        </Card>

        <div className="partner-page__stats">
          <StatCard label="Cliques" value={String(q.data?.linkViews ?? 0)} />
          <StatCard label="Cotações geradas" value={String(q.data?.linkLeads ?? 0)} />
          <StatCard label="Vendas" value={String(q.data?.linkSales ?? 0)} />
        </div>
      </QueryState>
    </div>
  );
}
