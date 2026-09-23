import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card } from '@shared/components/Card/Card';
import { Input } from '@shared/components/Input/Input';
import { Button } from '@shared/components/Button/Button';
import { StatCard } from '@shared/components/StatCard/StatCard';
import { QueryState } from '@shared/components/QueryState/QueryState';
import { useToast } from '@shared/components/Toaster/ToastContext';
import { formatCurrency } from '@shared/utils/formatters';
import { driverAffiliateApi } from '@shared/api/endpoints';
import './PartnerPages.css';

/** Programa de afiliação loja↔motorista — independente do afiliado solar.
 * A loja busca um motorista pelo nome, define uma comissão % sobre a venda
 * (por motorista ou um valor único pra todos), e pode remover depois. */
export function PartnerDriverAffiliatesPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [newCommission, setNewCommission] = useState('5');
  const [bulkCommission, setBulkCommission] = useState('');
  const [editing, setEditing] = useState<Record<string, string>>({});

  const searchQuery = useQuery({
    queryKey: ['driver-affiliate-search', query],
    queryFn: () => driverAffiliateApi.search(query),
    enabled: query.trim().length > 1,
  });
  const listQuery = useQuery({ queryKey: ['driver-affiliates'], queryFn: () => driverAffiliateApi.list() });
  const metricsQuery = useQuery({ queryKey: ['driver-affiliates-metrics'], queryFn: () => driverAffiliateApi.storeMetrics() });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['driver-affiliates'] });
    qc.invalidateQueries({ queryKey: ['driver-affiliate-search'] });
    qc.invalidateQueries({ queryKey: ['driver-affiliates-metrics'] });
  };

  const add = useMutation({
    mutationFn: (vars: { driverId: string; commissionPercent: number }) =>
      driverAffiliateApi.add(vars.driverId, vars.commissionPercent),
    onSuccess: () => {
      invalidate();
      toast.success('Motorista adicionado como afiliado.');
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Falha ao adicionar.'),
  });

  const update = useMutation({
    mutationFn: (vars: { driverId: string; commissionPercent: number }) =>
      driverAffiliateApi.update(vars.driverId, vars.commissionPercent),
    onSuccess: () => {
      invalidate();
      toast.success('Comissão atualizada.');
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Falha ao atualizar.'),
  });

  const bulkUpdate = useMutation({
    mutationFn: (commissionPercent: number) => driverAffiliateApi.bulkSetCommission(commissionPercent),
    onSuccess: () => {
      invalidate();
      toast.success('Comissão aplicada a todos os afiliados.');
      setBulkCommission('');
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Falha ao aplicar.'),
  });

  const remove = useMutation({
    mutationFn: (driverId: string) => driverAffiliateApi.remove(driverId),
    onSuccess: () => {
      invalidate();
      toast.success('Motorista removido dos afiliados.');
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Falha ao remover.'),
  });

  const affiliates = listQuery.data ?? [];
  const m = metricsQuery.data;

  return (
    <div className="partner-page">
      <header className="partner-page__header">
        <div>
          <h2>Motoristas afiliados</h2>
          <p className="text-muted">
            Adicione motoristas para indicarem sua loja aos clientes. Eles
            ganham uma comissão % sobre cada venda gerada pelo código deles
            no checkout.
          </p>
        </div>
      </header>

      {m && (
        <div className="partner-page__stats">
          <StatCard label="Pedidos com indicação" value={String(m.ordersCount)} />
          <StatCard label="Receita indicada" value={formatCurrency(m.revenue)} />
          <StatCard label="Comissão paga" value={formatCurrency(m.commissionPaid)} />
          <StatCard label="Cliques nos links" value={String(m.linkViews)} />
        </div>
      )}

      <Card>
        <h3>Buscar motorista</h3>
        <div className="row" style={{ alignItems: 'flex-end', marginTop: 'var(--space-3)' }}>
          <Input
            label="Nome do motorista"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Digite pelo menos 2 letras"
          />
          <Input
            label="Comissão (%)"
            inputMode="decimal"
            style={{ maxWidth: 120 }}
            value={newCommission}
            onChange={(e) => setNewCommission(e.target.value)}
          />
        </div>

        {query.trim().length > 1 && (
          <QueryState loading={searchQuery.isLoading} error={searchQuery.error} empty={(searchQuery.data ?? []).length === 0} emptyLabel="Nenhum motorista encontrado.">
            <div className="stack" style={{ marginTop: 'var(--space-3)' }}>
              {(searchQuery.data ?? []).map((d) => (
                <div key={d.id} className="row-between">
                  <div>
                    <strong>{d.name}</strong>
                    <small className="text-muted" style={{ display: 'block' }}>{d.email}</small>
                  </div>
                  <Button
                    size="sm"
                    disabled={d.alreadyAffiliated || add.isPending}
                    onClick={() => add.mutate({ driverId: d.id, commissionPercent: Number(newCommission) || 0 })}
                  >
                    {d.alreadyAffiliated ? 'Já é afiliado' : 'Adicionar'}
                  </Button>
                </div>
              ))}
            </div>
          </QueryState>
        )}
      </Card>

      <Card>
        <div className="row-between">
          <h3>Definir um valor de comissão pra todos</h3>
        </div>
        <div className="row" style={{ alignItems: 'flex-end', marginTop: 'var(--space-3)' }}>
          <Input
            label="Comissão (%)"
            inputMode="decimal"
            style={{ maxWidth: 160 }}
            value={bulkCommission}
            onChange={(e) => setBulkCommission(e.target.value)}
          />
          <Button
            variant="secondary"
            disabled={!bulkCommission || bulkUpdate.isPending || affiliates.length === 0}
            onClick={() => bulkUpdate.mutate(Number(bulkCommission) || 0)}
          >
            Aplicar a todos
          </Button>
        </div>
      </Card>

      <Card padded={false}>
        <QueryState loading={listQuery.isLoading} error={listQuery.error} empty={affiliates.length === 0} variant="list" emptyLabel="Nenhum motorista afiliado ainda.">
          <table className="history__table">
            <thead>
              <tr>
                <th>Motorista</th>
                <th>Comissão</th>
                <th>Cliques</th>
                <th>Pedidos</th>
                <th>Comissão paga</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {affiliates.map((a) => (
                <tr key={a.id}>
                  <td>
                    <strong>{a.driverName}</strong>
                    <small className="text-muted" style={{ display: 'block' }}>{a.driverEmail}</small>
                  </td>
                  <td>
                    <div className="row" style={{ alignItems: 'center' }}>
                      <input
                        className="input-field__el"
                        style={{ width: 70 }}
                        inputMode="decimal"
                        value={editing[a.driverId] ?? String(a.commissionPercent)}
                        onChange={(e) => setEditing((prev) => ({ ...prev, [a.driverId]: e.target.value }))}
                      />
                      <span>%</span>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={update.isPending}
                        onClick={() => update.mutate({ driverId: a.driverId, commissionPercent: Number(editing[a.driverId] ?? a.commissionPercent) || 0 })}
                      >
                        Salvar
                      </Button>
                    </div>
                  </td>
                  <td>{a.linkViews}</td>
                  <td>{a.ordersCount}</td>
                  <td className="text-accent">{formatCurrency(a.commissionEarned)}</td>
                  <td>
                    <Button size="sm" variant="secondary" disabled={remove.isPending} onClick={() => remove.mutate(a.driverId)}>
                      Remover
                    </Button>
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
