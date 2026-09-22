import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@shared/components/Card/Card';
import { Button } from '@shared/components/Button/Button';
import { StatCard } from '@shared/components/StatCard/StatCard';
import { QrCode } from '@shared/components/QrCode/QrCode';
import { QueryState } from '@shared/components/QueryState/QueryState';
import { Icon } from '@shared/components/Icon/Icon';
import { surveyApi } from '@shared/api/endpoints';
import { SERVER_ORIGIN } from '@shared/api/client';

/** Link pessoal da pesquisa de opinião — card na tela de Perfil, separado
 * do marketplace/cashback de propósito (campanha à parte). */
export function SurveyLinkCard() {
  const q = useQuery({ queryKey: ['survey-link'], queryFn: () => surveyApi.me() });
  const [copied, setCopied] = useState(false);

  const link = q.data?.code ? `${SERVER_ORIGIN}/r/pesquisa/${q.data.code}` : '';

  const copy = async () => {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card>
      <h3>
        <Icon name="clipboard" size={18} /> Minha pesquisa de opinião
      </h3>
      <p className="text-muted" style={{ marginTop: 'var(--space-1)' }}>
        Compartilhe este link ou o QR code — as respostas ficam contadas
        aqui.
      </p>

      <QueryState loading={q.isLoading} error={q.error} empty={false}>
        <div className="row" style={{ marginTop: 'var(--space-3)', alignItems: 'center' }}>
          <code style={{ flex: 1, wordBreak: 'break-all' }}>{link || 'Link ainda não disponível.'}</code>
          <Button onClick={copy} disabled={!link}>
            {copied ? 'Copiado!' : 'Copiar link'}
          </Button>
        </div>

        {link && (
          <div style={{ marginTop: 'var(--space-4)' }}>
            <QrCode value={link} size={160} />
          </div>
        )}

        <div className="row" style={{ marginTop: 'var(--space-4)', gap: 'var(--space-3)' }}>
          <StatCard label="Visitas" value={String(q.data?.views ?? 0)} />
          <StatCard label="Respostas" value={String(q.data?.responses ?? 0)} />
          <StatCard label="Contatos captados" value={String(q.data?.leads ?? 0)} />
        </div>
      </QueryState>
    </Card>
  );
}
