import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button } from '@shared/components/Button/Button';
import { Card } from '@shared/components/Card/Card';
import { Modal } from '@shared/components/Modal/Modal';
import { QueryState } from '@shared/components/QueryState/QueryState';
import { useToast } from '@shared/components/Toaster/ToastContext';
import { formatDateTime } from '@shared/utils/formatters';
import { type IncidentRow, opendriverAdmin } from '../api';
import { errorText, Pagination, RequireOpenDriver, usePrivateBlob } from './shared';
import '../../admin/pages/AdminPages.css';
import './OpenDriver.css';

const statusLabel: Record<IncidentRow['status'], string> = { Open: 'Aberta', InReview: 'Em análise', Closed: 'Encerrada' };

/**
 * Ocorrências de segurança (RF15/RF16). Gravações só abrem quando há
 * ocorrência na corrida, e cada acesso fica na auditoria.
 */
export function OpenDriverSafetyPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [status, setStatus] = useState('Open');
  const [page, setPage] = useState(1);
  const [rideId, setRideId] = useState<string | null>(null);
  const q = useQuery({ queryKey: ['od', 'incidents', status, page], queryFn: () => opendriverAdmin.incidents({ status: status || undefined, page }), refetchInterval: 30_000 });

  const setIncident = useMutation({
    mutationFn: (v: { id: string; status: IncidentRow['status'] }) => opendriverAdmin.setIncidentStatus(v.id, v.status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['od', 'incidents'] });
      qc.invalidateQueries({ queryKey: ['od', 'metrics'] });
    },
    onError: (e) => toast.error(errorText(e)),
  });

  return (
    <div className="admin-page">
      <header className="admin-page__header">
        <div>
          <h2>Segurança</h2>
          <p className="text-muted">Emergências e relatos de passageiros e motoristas. Emergências também chegam por push para os admins.</p>
        </div>
      </header>
      <RequireOpenDriver>
        <div className="admin-filters">
          <div className="admin-filters__select">
            <label htmlFor="od-inc-status">Situação</label>
            <select
              id="od-inc-status"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="Open">Abertas</option>
              <option value="InReview">Em análise</option>
              <option value="Closed">Encerradas</option>
              <option value="">Todas</option>
            </select>
          </div>
        </div>
        <Card padded={false}>
          <QueryState loading={q.isLoading} error={q.error} empty={q.data?.items.length === 0} variant="list" emptyLabel="Nenhuma ocorrência.">
            <table className="history__table">
              <thead>
                <tr>
                  <th>Quando</th>
                  <th>Tipo</th>
                  <th>Quem relatou</th>
                  <th>Relato</th>
                  <th>Situação</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {q.data?.items.map((i) => (
                  <tr key={i.id}>
                    <td>{formatDateTime(i.createdAt)}</td>
                    <td>{i.type === 'Emergency' ? <span className="badge badge-danger">Emergência</span> : <span className="badge">Relato</span>}</td>
                    <td>
                      {i.reporter}
                      <small className="text-muted" style={{ display: 'block' }}>
                        {i.reporterPhone ?? ''}
                      </small>
                    </td>
                    <td>
                      {i.description}
                      {i.lat !== null && i.lng !== null ? (
                        <a style={{ display: 'block' }} href={`https://www.openstreetmap.org/?mlat=${i.lat}&mlon=${i.lng}#map=17/${i.lat}/${i.lng}`} target="_blank" rel="noreferrer">
                          Ver local no mapa
                        </a>
                      ) : null}
                    </td>
                    <td>{statusLabel[i.status]}</td>
                    <td>
                      <div className="od-actions">
                        {i.rideId ? (
                          <Button size="sm" variant="secondary" onClick={() => setRideId(i.rideId)}>
                            Corrida e áudio
                          </Button>
                        ) : null}
                        {i.status === 'Open' ? (
                          <Button size="sm" variant="ghost" onClick={() => setIncident.mutate({ id: i.id, status: 'InReview' })}>
                            Analisar
                          </Button>
                        ) : null}
                        {i.status !== 'Closed' ? (
                          <Button size="sm" variant="ghost" onClick={() => setIncident.mutate({ id: i.id, status: 'Closed' })}>
                            Encerrar
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </QueryState>
        </Card>
        {q.data ? <Pagination page={q.data.page} totalPages={q.data.totalPages} onChange={setPage} /> : null}
        {rideId ? <RecordingsModal rideId={rideId} onClose={() => setRideId(null)} /> : null}
      </RequireOpenDriver>
    </div>
  );
}

function RecordingsModal({ rideId, onClose }: { rideId: string; onClose: () => void }) {
  const q = useQuery({ queryKey: ['od', 'ride', rideId], queryFn: () => opendriverAdmin.ride(rideId) });
  const recs = q.data?.recordings.filter((r) => !r.deleted) ?? [];
  return (
    <Modal open title="Gravações da corrida" onClose={onClose}>
      <QueryState loading={q.isLoading} error={q.error} empty={recs.length === 0} emptyLabel="Sem gravações nesta corrida (ou já expiraram).">
        <div className="stack">
          <p className="text-muted">
            {q.data?.ride.passengerName} com {q.data?.ride.driverName ?? '—'} · {q.data?.ride.origin.address} → {q.data?.ride.destination.address}
          </p>
          {recs.map((r) => (
            <Recording key={r.id} id={r.id} sizeBytes={r.sizeBytes} expiresAt={r.expiresAt} />
          ))}
        </div>
      </QueryState>
    </Modal>
  );
}

function Recording({ id, sizeBytes, expiresAt }: { id: string; sizeBytes: number; expiresAt: string }) {
  const [open, setOpen] = useState(false);
  const { url, error } = usePrivateBlob(open ? id : null, () => opendriverAdmin.recording(id));
  return (
    <Card>
      <div className="row-between">
        <span>
          Áudio · {(sizeBytes / 1024 / 1024).toFixed(1)} MB · apagado em {formatDateTime(expiresAt)}
        </span>
        {!open ? (
          <Button size="sm" onClick={() => setOpen(true)}>
            Ouvir
          </Button>
        ) : null}
      </div>
      {open && error ? <p className="text-muted">{error}</p> : null}
      {open && url ? <audio controls src={url} style={{ width: '100%', marginTop: 8 }} /> : null}
    </Card>
  );
}
