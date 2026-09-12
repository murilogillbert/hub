import { useQuery } from '@tanstack/react-query';
import { Card } from '@shared/components/Card/Card';
import { QueryState } from '@shared/components/QueryState/QueryState';
import { affiliateApi } from '@shared/api/endpoints';
import '../PartnerPages.css';

export function AffiliateMaterialsPage() {
  const q = useQuery({ queryKey: ['affiliate-materials'], queryFn: () => affiliateApi.materials() });
  const items = q.data ?? [];

  return (
    <div className="partner-page">
      <header className="partner-page__header">
        <div>
          <h2>Materiais de campanha</h2>
          <p className="text-muted">Baixe os materiais prontos para divulgar aos seus contatos.</p>
        </div>
      </header>

      <QueryState
        loading={q.isLoading}
        error={q.error}
        empty={items.length === 0}
        variant="cards"
        emptyLabel="Nenhum material disponível no momento."
      >
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
          {items.map((m) => (
            <Card key={m.id}>
              <h3>{m.title}</h3>
              {m.description && <p className="text-muted">{m.description}</p>}
              <a href={m.fileUrl} target="_blank" rel="noreferrer">
                Abrir / baixar →
              </a>
            </Card>
          ))}
        </div>
      </QueryState>
    </div>
  );
}
