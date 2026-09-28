import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button } from '@shared/components/Button/Button';
import { Card } from '@shared/components/Card/Card';
import { Input } from '@shared/components/Input/Input';
import { Modal } from '@shared/components/Modal/Modal';
import { QueryState } from '@shared/components/QueryState/QueryState';
import { useToast } from '@shared/components/Toaster/ToastContext';
import { formatCurrency, formatDateTime } from '@shared/utils/formatters';
import { opendriverAdmin, type RideStatus, rideStatusLabel } from '../api';
import { errorText, Pagination, RequireOpenDriver } from './shared';
import '../../admin/pages/AdminPages.css';
import './OpenDriver.css';

const paymentLabel: Record<string, string> = {
  NotDue: '—',
  Pending: 'Pendente',
  Paid: 'Pago',
  Failed: 'Falhou',
  Refunded: 'Estornado',
  NotRequired: 'Sem cobrança',
};

const eventLabel: Record<string, string> = {
  requested: 'Corrida pedida',
  offer_sent: 'Oferta enviada',
  offer_declined: 'Oferta recusada',
  offer_expired: 'Oferta expirou',
  accepted: 'Motorista aceitou',
  arrived: 'Motorista chegou',
  started: 'Viagem iniciada',
  completed: 'Viagem concluída',
  passenger_cancelled: 'Passageiro cancelou',
  driver_cancelled: 'Motorista desistiu (nova busca)',
  admin_cancelled: 'Cancelada pela administração',
  no_drivers: 'Sem motorista disponível',
  emergency: 'Botão de emergência',
};
const actorLabel: Record<string, string> = { Passenger: 'passageiro', Driver: 'motorista', System: 'sistema', Admin: 'admin' };

const ACTIVE: RideStatus[] = ['Searching', 'DriverAssigned', 'DriverArrived', 'InProgress'];

/** Acompanhamento de corridas (RF17): linha do tempo, pagamentos e cancelamento forçado. */
export function OpenDriverRidesPage() {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const q = useQuery({ queryKey: ['od', 'rides', status, page], queryFn: () => opendriverAdmin.rides({ status: status || undefined, page }) });

  return (
    <div className="admin-page">
      <header className="admin-page__header">
        <div>
          <h2>Corridas</h2>
          <p className="text-muted">Clique numa corrida para ver a linha do tempo, pagamentos e ocorrências.</p>
        </div>
      </header>
      <RequireOpenDriver>
        <div className="admin-filters">
          <div className="admin-filters__select">
            <label htmlFor="od-ride-status">Situação</label>
            <select
              id="od-ride-status"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Todas</option>
              {Object.entries(rideStatusLabel).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
        </div>
        <Card padded={false}>
          <QueryState loading={q.isLoading} error={q.error} empty={q.data?.items.length === 0} variant="list" emptyLabel="Nenhuma corrida.">
            <table className="history__table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Passageiro / motorista</th>
                  <th>Trajeto</th>
                  <th>Situação</th>
                  <th>Pagamento</th>
                  <th>Valor</th>
                </tr>
              </thead>
              <tbody>
                {q.data?.items.map((r) => (
                  <tr key={r.id} className="od-row-click" onClick={() => setSelected(r.id)}>
                    <td>{formatDateTime(r.requestedAt)}</td>
                    <td>
                      {r.passenger}
                      <small className="text-muted" style={{ display: 'block' }}>
                        {r.driver ?? 'sem motorista'}
                      </small>
                    </td>
                    <td>
                      <small>{r.origin}</small>
                      <small className="text-muted" style={{ display: 'block' }}>
                        → {r.destination}
                      </small>
                    </td>
                    <td>{rideStatusLabel[r.status]}</td>
                    <td>
                      <span className={r.paymentStatus === 'Failed' ? 'badge badge-danger' : 'badge'}>{paymentLabel[r.paymentStatus] ?? r.paymentStatus}</span>
                    </td>
                    <td>{formatCurrency(r.fare)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </QueryState>
        </Card>
        {q.data ? <Pagination page={q.data.page} totalPages={q.data.totalPages} onChange={setPage} /> : null}
        {selected ? <RideModal id={selected} onClose={() => setSelected(null)} /> : null}
      </RequireOpenDriver>
    </div>
  );
}

function RideModal({ id, onClose }: { id: string; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [reason, setReason] = useState('');
  const q = useQuery({ queryKey: ['od', 'ride', id], queryFn: () => opendriverAdmin.ride(id) });
  const cancel = useMutation({
    mutationFn: () => opendriverAdmin.cancelRide(id, reason.trim()),
    onSuccess: (d) => {
      qc.setQueryData(['od', 'ride', id], d);
      qc.invalidateQueries({ queryKey: ['od', 'rides'] });
      toast.success('Corrida cancelada. Passageiro e motorista foram avisados.');
    },
    onError: (e) => toast.error(errorText(e)),
  });

  const d = q.data;
  return (
    <Modal open title="Corrida" onClose={onClose}>
      <QueryState loading={q.isLoading} error={q.error}>
        {d ? (
          <div className="stack">
            <dl className="od-kv">
              <dt>Situação</dt>
              <dd>{rideStatusLabel[d.ride.status]}</dd>
              <dt>Passageiro</dt>
              <dd>{d.ride.passengerName}</dd>
              <dt>Motorista</dt>
              <dd>{d.ride.driverName ?? '—'}</dd>
              <dt>Trajeto</dt>
              <dd>
                {d.ride.origin.address} → {d.ride.destination.address} ({(d.ride.distanceM / 1000).toFixed(1)} km)
              </dd>
              <dt>Valor</dt>
              <dd>
                {formatCurrency(d.ride.fare)} · motorista {formatCurrency(d.ride.driverEarning)} · plataforma {formatCurrency(d.ride.platformFee)}
                {d.ride.cashbackUsed ? ` · cashback ${formatCurrency(d.ride.cashbackUsed)}` : ''}
              </dd>
              <dt>Pagamento</dt>
              <dd>
                {d.ride.payment.label} · {paymentLabel[d.ride.payment.status] ?? d.ride.payment.status}
                {d.ride.payment.failureReason ? ` — ${d.ride.payment.failureReason}` : ''}
              </dd>
            </dl>

            <h4>Linha do tempo</h4>
            <ul className="od-timeline">
              {d.events.map((e, i) => (
                <li key={i}>
                  {formatDateTime(e.at)} — <strong>{eventLabel[e.type] ?? e.type}</strong> ({actorLabel[e.actor] ?? e.actor})
                </li>
              ))}
            </ul>

            {d.payments.length ? (
              <>
                <h4>Cobranças</h4>
                <ul className="od-timeline">
                  {d.payments.map((p) => (
                    <li key={p.id}>
                      {formatDateTime(p.at)} — {p.method === 'Card' ? 'Cartão' : 'Pix'} {formatCurrency(p.amount)} · {paymentLabel[p.status] ?? p.status} {p.detail ? `(${p.detail})` : ''} {p.externalId ? <code>{p.externalId}</code> : null}
                    </li>
                  ))}
                </ul>
              </>
            ) : null}

            {d.incidents.length ? (
              <>
                <h4>Ocorrências</h4>
                <ul className="od-timeline">
                  {d.incidents.map((i) => (
                    <li key={i.id}>
                      {formatDateTime(i.at)} — {i.type === 'Emergency' ? 'Emergência' : 'Relato'} · {{ Open: 'Aberta', InReview: 'Em análise', Closed: 'Encerrada' }[i.status] ?? i.status} {i.description ? `— ${i.description}` : ''}
                    </li>
                  ))}
                </ul>
              </>
            ) : null}

            {d.recordings.length ? (
              <p className="text-muted">
                {d.recordings.filter((r) => !r.deleted).length} gravação(ões) de áudio. Ouça pela tela Segurança (exige ocorrência registrada).
              </p>
            ) : null}

            {ACTIVE.includes(d.ride.status) ? (
              <>
                <Input label="Motivo do cancelamento" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={400} />
                <Button variant="danger" disabled={reason.trim().length < 3 || cancel.isPending} onClick={() => cancel.mutate()}>
                  Cancelar corrida (sem cobrança)
                </Button>
              </>
            ) : null}
          </div>
        ) : null}
      </QueryState>
    </Modal>
  );
}
