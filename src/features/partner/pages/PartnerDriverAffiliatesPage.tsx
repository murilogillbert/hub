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
 * A loja adiciona um motorista pelo CÓDIGO único dele (o mesmo que ele usa
 * no checkout) — nunca por nome/e-mail, pra não expor dado de motorista
 * nenhum sem ele ter compartilhado o próprio código primeiro. Define uma
 * comissão % sobre a venda (por motorista ou um valor único pra todos), e
 * pode remover depois. */
export function PartnerDriverAffiliatesPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [code, setCode] = useState('');
  const [searchedCode, setSearchedCode] = useState('');
  const [newCommission, setNewCommission] = useState(5);
  const [bulkCommission, setBulkCommission] = useState<number | ''>('');
  const [editing, setEditing] = useState<Record<string, number>>({});

  const searchQuery = useQuery({
    queryKey: ['driver-affiliate-search', searchedCode],
    queryFn: () => driverAffiliateApi.search(searchedCode),
    enabled: searchedCode.trim().length > 0,
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
    onSuccess: (_d, vars) => {
      invalidate();
      setEditing((prev) => {
        const next = { ...prev };
        delete next[vars.driverId];
        return next;
      });
      toast.success('Comissão atualizada.');
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Falha ao atualizar.'),
  });

  const bulkUpdate = useMutation({
    mutationFn: (commissionPercent: number) => driverAffiliateApi.bulkSetCommission(commissionPercent),
    onSuccess: () => {
      invalidate();
      setEditing({});
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
            Adicione motoristas pelo código de indicação deles (o motorista
            encontra o próprio código no perfil) para indicarem sua loja aos
            clientes. Eles ganham uma comissão % sobre cada venda gerada pelo
            código no checkout.
          </p>
        </div>
      </header>

      <QueryState loading={metricsQuery.isLoading} error={metricsQuery.error} empty={false}>
        {m && (
          <div className="partner-page__stats">
            <StatCard label="Pedidos com indicação" value={String(m.ordersCount)} />
            <StatCard label="Receita indicada" value={formatCurrency(m.revenue)} />
            <StatCard label="Comissão paga" value={formatCurrency(m.commissionPaid)} />
            <StatCard label="Cliques nos links" value={String(m.linkViews)} />
          </div>
        )}
      </QueryState>

      <Card>
        <h3>Adicionar motorista pelo código</h3>
        <form
          className="row"
          style={{ alignItems: 'flex-end', marginTop: 'var(--space-3)' }}
          onSubmit={(e) => {
            e.preventDefault();
            setSearchedCode(code.trim());
          }}
        >
          <Input
            label="Código do motorista"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Peça o código pro motorista"
          />
          <div style={{ maxWidth: 120, flex: 'none' }}>
            <Input
              label="Comissão (%)"
              type="number"
              min={0}
              max={100}
              value={newCommission}
              onChange={(e) => setNewCommission(Number(e.target.value))}
            />
          </div>
          <Button type="submit" variant="secondary" disabled={!code.trim()}>
            Buscar
          </Button>
        </form>

        {searchedCode && (
          <QueryState
            loading={searchQuery.isLoading}
            error={searchQuery.error}
            empty={(searchQuery.data ?? []).length === 0}
            emptyLabel="Nenhum motorista encontrado com esse código."
          >
            <div className="stack" style={{ marginTop: 'var(--space-3)' }}>
              {(searchQuery.data ?? []).map((d) => (
                <div key={d.id} className="row-between">
                  <strong>{d.name}</strong>
                  <Button
                    size="sm"
                    disabled={d.alreadyAffiliated || add.isPending}
                    onClick={() => add.mutate({ driverId: d.id, commissionPercent: newCommission })}
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
        <h3>Definir um valor de comissão pra todos</h3>
        <div className="row" style={{ alignItems: 'flex-end', marginTop: 'var(--space-3)' }}>
          <div style={{ maxWidth: 160, flex: 'none' }}>
            <Input
              label="Comissão (%)"
              type="number"
              min={0}
              max={100}
              value={bulkCommission}
              onChange={(e) => setBulkCommission(e.target.value === '' ? '' : Number(e.target.value))}
            />
          </div>
          <Button
            variant="secondary"
            disabled={bulkCommission === '' || bulkUpdate.isPending || affiliates.length === 0}
            onClick={() => bulkUpdate.mutate(bulkCommission === '' ? 0 : bulkCommission)}
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
                      <div style={{ maxWidth: 90, flex: 'none' }}>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={editing[a.driverId] ?? a.commissionPercent}
                          onChange={(e) => setEditing((prev) => ({ ...prev, [a.driverId]: Number(e.target.value) }))}
                        />
                      </div>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={update.isPending}
                        onClick={() => update.mutate({ driverId: a.driverId, commissionPercent: editing[a.driverId] ?? a.commissionPercent })}
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
