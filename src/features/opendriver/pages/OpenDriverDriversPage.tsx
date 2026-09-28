import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@shared/components/Button/Button';
import { Card } from '@shared/components/Card/Card';
import { Input } from '@shared/components/Input/Input';
import { Modal } from '@shared/components/Modal/Modal';
import { QueryState } from '@shared/components/QueryState/QueryState';
import { useToast } from '@shared/components/Toaster/ToastContext';
import { formatCurrency, formatDate } from '@shared/utils/formatters';
import { type DriverDetail, driverStatusLabel, type DriverStatus, opendriverAdmin } from '../api';
import { errorText, Pagination, PrivateImage, RequireOpenDriver } from './shared';
import '../../admin/pages/AdminPages.css';
import './OpenDriver.css';

const badge: Record<DriverStatus, string> = {
  PendingDocuments: 'badge',
  InReview: 'badge badge-warning',
  Approved: 'badge badge-accent',
  Rejected: 'badge badge-danger',
  Suspended: 'badge badge-danger',
};

/** Análise de cadastro de motoristas (RF13, RF17). Ver documento é auditado. */
export function OpenDriverDriversPage() {
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? '';
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ['od', 'drivers', status, search, page],
    queryFn: () => opendriverAdmin.drivers({ status: status || undefined, q: search.trim() || undefined, page }),
  });

  return (
    <div className="admin-page">
      <header className="admin-page__header">
        <div>
          <h2>Motoristas</h2>
          <p className="text-muted">Confira CNH, selfie e CRLV antes de aprovar. Toda visualização de documento fica registrada na auditoria.</p>
        </div>
      </header>
      <RequireOpenDriver>
        <div className="admin-filters">
          <Input label="Buscar" placeholder="Nome ou e-mail" value={search} onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }} />
          <div className="admin-filters__select">
            <label htmlFor="od-status">Situação</label>
            <select
              id="od-status"
              value={status}
              onChange={(e) => {
                setPage(1);
                setParams(e.target.value ? { status: e.target.value } : {});
              }}
            >
              <option value="">Todas</option>
              {Object.entries(driverStatusLabel).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
        </div>
        <Card padded={false}>
          <QueryState loading={q.isLoading} error={q.error} empty={q.data?.items.length === 0} variant="list" emptyLabel="Nenhum motorista encontrado.">
            <table className="history__table">
              <thead>
                <tr>
                  <th>Motorista</th>
                  <th>Telefone</th>
                  <th>Situação</th>
                  <th>Nota</th>
                  <th>Atualizado</th>
                </tr>
              </thead>
              <tbody>
                {q.data?.items.map((d) => (
                  <tr key={d.userId} className="od-row-click" onClick={() => setSelected(d.userId)}>
                    <td>
                      <strong>{d.name}</strong>
                      <small className="text-muted" style={{ display: 'block' }}>
                        {d.email}
                      </small>
                    </td>
                    <td>{d.phone ?? '—'}</td>
                    <td>
                      <span className={badge[d.status]}>{driverStatusLabel[d.status]}</span> {d.isOnline ? <span className="badge badge-primary">Online</span> : null}
                    </td>
                    <td>{d.rating?.toFixed(1) ?? '—'}</td>
                    <td>{formatDate(d.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </QueryState>
        </Card>
        {q.data ? <Pagination page={q.data.page} totalPages={q.data.totalPages} onChange={setPage} /> : null}
        {selected ? <DriverModal id={selected} onClose={() => setSelected(null)} /> : null}
      </RequireOpenDriver>
    </div>
  );
}

function DriverModal({ id, onClose }: { id: string; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [reason, setReason] = useState('');
  const q = useQuery({ queryKey: ['od', 'driver', id], queryFn: () => opendriverAdmin.driver(id) });

  const act = useMutation({
    mutationFn: (fn: () => Promise<DriverDetail>) => fn(),
    onSuccess: (d) => {
      qc.setQueryData(['od', 'driver', id], d);
      qc.invalidateQueries({ queryKey: ['od', 'drivers'] });
      qc.invalidateQueries({ queryKey: ['od', 'metrics'] });
      setReason('');
      toast.success('Feito. O motorista foi avisado por notificação.');
    },
    onError: (e) => toast.error(errorText(e)),
  });

  const needReason = (fn: (r: string) => Promise<DriverDetail>) => () => {
    if (reason.trim().length < 3) {
      toast.error('Escreva o motivo — ele é mostrado ao motorista.');
      return;
    }
    act.mutate(() => fn(reason.trim()));
  };

  const d = q.data;
  return (
    <Modal open title={d ? d.name : 'Motorista'} onClose={onClose}>
      <QueryState loading={q.isLoading} error={q.error}>
        {d ? (
          <div className="stack">
            <dl className="od-kv">
              <dt>Situação</dt>
              <dd>
                {driverStatusLabel[d.status]}
                {d.rejectionReason ? ` — ${d.rejectionReason}` : ''}
              </dd>
              <dt>E-mail</dt>
              <dd>{d.email}</dd>
              <dt>Telefone</dt>
              <dd>{d.phone ?? '—'}</dd>
              <dt>CPF</dt>
              <dd>{d.cpf ?? '—'}</dd>
              <dt>CNH</dt>
              <dd>
                {d.cnhNumber ?? '—'} · categoria {d.cnhCategory ?? '—'} · validade {d.cnhExpiresAt ? formatDate(d.cnhExpiresAt) : '—'}
              </dd>
              <dt>Nascimento</dt>
              <dd>{d.birthDate ? formatDate(d.birthDate) : '—'}</dd>
              <dt>Chave Pix</dt>
              <dd>{d.pixKey ? `${d.pixKey} (${d.pixKeyType})` : '—'}</dd>
              <dt>Corridas / saldo</dt>
              <dd>
                {d.completedRides} · {formatCurrency(d.balance)}
              </dd>
            </dl>

            <h4>Documentos</h4>
            <div className="od-docs">
              {d.hasCnhPhoto ? <PrivateImage fileKey={`cnh-${id}`} load={() => opendriverAdmin.driverDocument(id, 'cnh')} alt="CNH" /> : <p className="text-muted">CNH não enviada.</p>}
              {d.hasSelfie ? <PrivateImage fileKey={`selfie-${id}`} load={() => opendriverAdmin.driverDocument(id, 'selfie')} alt="Selfie" /> : <p className="text-muted">Selfie não enviada.</p>}
            </div>

            <h4>Veículos</h4>
            {d.vehicles.filter((v) => v.active).length === 0 ? <p className="text-muted">Nenhum veículo.</p> : null}
            {d.vehicles
              .filter((v) => v.active)
              .map((v) => (
                <Card key={v.id}>
                  <div className="row-between">
                    <strong>
                      {v.brand} {v.model} {v.year} · {v.plate} · {v.color}
                    </strong>
                    <span className={v.status === 'Approved' ? 'badge badge-accent' : v.status === 'Rejected' ? 'badge badge-danger' : 'badge badge-warning'}>
                      {v.status === 'Approved' ? 'Aprovado' : v.status === 'Rejected' ? 'Recusado' : 'Em análise'}
                    </span>
                  </div>
                  {v.hasCrlv ? <PrivateImage fileKey={`crlv-${v.id}`} load={() => opendriverAdmin.vehicleCrlv(v.id)} alt="CRLV" /> : <p className="text-muted">CRLV não enviado.</p>}
                  <div className="od-actions">
                    <Button size="sm" disabled={!v.hasCrlv || v.status === 'Approved' || act.isPending} onClick={() => act.mutate(() => opendriverAdmin.approveVehicle(v.id))}>
                      Aprovar veículo
                    </Button>
                    <Button size="sm" variant="ghost" disabled={v.status === 'Rejected' || act.isPending} onClick={needReason((r) => opendriverAdmin.rejectVehicle(v.id, r))}>
                      Recusar veículo
                    </Button>
                  </div>
                </Card>
              ))}

            <Input label="Motivo (para recusar ou suspender)" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={400} placeholder="Ex.: foto da CNH ilegível" />
            <div className="od-actions">
              {d.status === 'InReview' || d.status === 'Rejected' ? (
                <Button disabled={act.isPending} onClick={() => act.mutate(() => opendriverAdmin.approveDriver(id))}>
                  Aprovar motorista
                </Button>
              ) : null}
              {d.status === 'InReview' || d.status === 'PendingDocuments' ? (
                <Button variant="secondary" disabled={act.isPending} onClick={needReason((r) => opendriverAdmin.rejectDriver(id, r))}>
                  Pedir ajustes
                </Button>
              ) : null}
              {d.status === 'Approved' ? (
                <Button variant="danger" disabled={act.isPending} onClick={needReason((r) => opendriverAdmin.suspendDriver(id, r))}>
                  Suspender
                </Button>
              ) : null}
              {d.status === 'Suspended' ? (
                <Button disabled={act.isPending} onClick={() => act.mutate(() => opendriverAdmin.reactivateDriver(id))}>
                  Reativar
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
      </QueryState>
    </Modal>
  );
}
