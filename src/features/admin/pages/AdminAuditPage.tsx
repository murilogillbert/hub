import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@shared/components/Card/Card';
import { Input } from '@shared/components/Input/Input';
import { QueryState } from '@shared/components/QueryState/QueryState';
import { adminApi } from '@shared/api/endpoints';
import { formatDateTime } from '@shared/utils/formatters';
import './AdminPages.css';

export function AdminAuditPage() {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');
  const [userId, setUserId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const auditQuery = useQuery({
    queryKey: ['admin-audit', action, userId, from, to, page],
    queryFn: () =>
      adminApi.auditLogs({
        action: action || undefined,
        userId: userId || undefined,
        from: from ? new Date(`${from}T00:00:00`).toISOString() : undefined,
        to: to ? new Date(`${to}T23:59:59`).toISOString() : undefined,
        page,
        pageSize: 20,
      }),
  });

  const data = auditQuery.data;
  const logs = data?.items ?? [];
  const resetPage = <T,>(setter: (value: T) => void, value: T) => {
    setter(value);
    setPage(1);
  };

  return (
    <div className="admin-page">
      <header className="admin-page__header">
        <div>
          <h2>Auditoria</h2>
          <p className="text-muted">
            Consulte eventos administrativos e operacionais gravados no sistema.
          </p>
        </div>
      </header>

      <Card>
        <div className="admin-filters admin-filters--audit">
          <Input
            label="Evento"
            placeholder="Ex.: order.redeem"
            value={action}
            onChange={(e) => resetPage(setAction, e.target.value)}
          />
          <Input
            label="Usuario"
            placeholder="ID do usuario"
            value={userId}
            onChange={(e) => resetPage(setUserId, e.target.value)}
          />
          <Input
            label="De"
            type="date"
            value={from}
            onChange={(e) => resetPage(setFrom, e.target.value)}
          />
          <Input
            label="Ate"
            type="date"
            value={to}
            onChange={(e) => resetPage(setTo, e.target.value)}
          />
        </div>
      </Card>

      <Card padded={false}>
        <QueryState
          loading={auditQuery.isLoading}
          error={auditQuery.error}
          empty={logs.length === 0}
          emptyLabel="Nenhum evento encontrado."
          variant="list"
        >
          <table className="history__table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Evento</th>
                <th>Usuario</th>
                <th>Entidade</th>
                <th>Payload</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td>{formatDateTime(log.createdAt)}</td>
                  <td>
                    <span className="badge badge-primary">{log.action}</span>
                  </td>
                  <td>{log.actorName ?? log.actorId ?? 'Sistema'}</td>
                  <td>
                    {log.entityType}
                    <br />
                    <small className="text-muted">{log.entityId}</small>
                  </td>
                  <td>
                    <code className="admin-audit__payload">
                      {log.payloadJson ?? '-'}
                    </code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </QueryState>
      </Card>

      {data && (
        <div className="admin-pagination">
          <span>
            Pagina {data.page} de {data.totalPages} - {data.total} evento(s)
          </span>
          <div className="row">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Anterior
            </button>
            <button
              type="button"
              disabled={page >= data.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Proxima
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
