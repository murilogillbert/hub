import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card } from '@shared/components/Card/Card';
import { Button } from '@shared/components/Button/Button';
import { QueryState } from '@shared/components/QueryState/QueryState';
import { useToast } from '@shared/components/Toaster/ToastContext';
import { formatDateTime } from '@shared/utils/formatters';
import { adminApi } from '@shared/api/endpoints';
import './AdminPages.css';

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pendente',
  approved: 'Aprovada',
  rejected: 'Rejeitada',
};
const STATUS_BADGE: Record<string, string> = {
  pending: 'badge-warning',
  approved: 'badge-accent',
  rejected: 'badge-danger',
};

export function AdminAffiliateApplicationsPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [status, setStatus] = useState('pending');

  const q = useQuery({
    queryKey: ['admin-affiliate-applications', status],
    queryFn: () => adminApi.affiliateApplications(status || undefined),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin-affiliate-applications'] });

  const approve = useMutation({
    mutationFn: (id: string) => adminApi.approveAffiliateApplication(id),
    onSuccess: () => {
      invalidate();
      toast.success('Afiliado aprovado — e-mail de boas-vindas enviado (se o Gmail estiver configurado).');
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Falha ao aprovar.'),
  });
  const reject = useMutation({
    mutationFn: (id: string) => adminApi.rejectAffiliateApplication(id),
    onSuccess: () => {
      invalidate();
      toast.success('Inscrição rejeitada.');
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Falha ao rejeitar.'),
  });

  const items = q.data ?? [];

  return (
    <div className="admin-page">
      <header className="admin-page__header">
        <div>
          <h2>Inscrições de afiliados</h2>
          <p className="text-muted">
            Aprovar cria a conta do consultor (Partner + login) e envia e-mail
            com as credenciais.
          </p>
        </div>
        <div className="admin-filters__select">
          <label>Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="pending">Pendentes</option>
            <option value="approved">Aprovadas</option>
            <option value="rejected">Rejeitadas</option>
            <option value="">Todas</option>
          </select>
        </div>
      </header>

      <Card padded={false}>
        <QueryState
          loading={q.isLoading}
          error={q.error}
          empty={items.length === 0}
          variant="list"
          emptyLabel="Nenhuma inscrição encontrada."
        >
          <table className="history__table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Contato</th>
                <th>Local</th>
                <th>Recebida em</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((a) => (
                <tr key={a.id}>
                  <td>
                    <strong>{a.name}</strong>
                    {a.message && (
                      <>
                        <br />
                        <small className="text-muted">{a.message}</small>
                      </>
                    )}
                  </td>
                  <td>
                    {a.email}
                    {a.phone && (
                      <>
                        <br />
                        <small className="text-muted">{a.phone}</small>
                      </>
                    )}
                  </td>
                  <td>
                    {a.city}
                    {a.state ? ` - ${a.state}` : ''}
                  </td>
                  <td>{formatDateTime(a.createdAt)}</td>
                  <td>
                    <span className={`badge ${STATUS_BADGE[a.status]}`}>
                      {STATUS_LABEL[a.status]}
                    </span>
                  </td>
                  <td>
                    {a.status === 'pending' && (
                      <div className="row">
                        <Button
                          size="sm"
                          onClick={() => approve.mutate(a.id)}
                          disabled={approve.isPending || reject.isPending}
                        >
                          Aprovar
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => reject.mutate(a.id)}
                          disabled={approve.isPending || reject.isPending}
                        >
                          Rejeitar
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </QueryState>
      </Card>
    </div>
  );
}
