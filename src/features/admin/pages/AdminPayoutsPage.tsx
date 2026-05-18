import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card } from '@shared/components/Card/Card';
import { Input } from '@shared/components/Input/Input';
import { Button } from '@shared/components/Button/Button';
import { QueryState } from '@shared/components/QueryState/QueryState';
import { useToast } from '@shared/components/Toaster/ToastContext';
import { adminApi } from '@shared/api/endpoints';
import { formatCurrency } from '@shared/utils/formatters';
import {
  downloadTextFile,
  openPrintableReport,
  csvCell,
  buildCsv,
  htmlEscape,
} from '@shared/utils/exportReport';
import './AdminPages.css';

const iso = (d: Date) => d.toISOString().slice(0, 10);

// Sugestão: último pacote de 10 dias encerrado (pago 10 dias depois).
function defaultPeriod() {
  const end = new Date();
  end.setDate(end.getDate() - 10);
  const start = new Date(end);
  start.setDate(start.getDate() - 9);
  return { start: iso(start), end: iso(end) };
}

export function AdminPayoutsPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [partnerId, setPartnerId] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [period, setPeriod] = useState(defaultPeriod);

  const summaryQuery = useQuery({
    queryKey: ['payout-summary'],
    queryFn: () => adminApi.payoutSummary(),
  });
  const historyQuery = useQuery({
    queryKey: ['payouts', partnerId || 'all'],
    queryFn: () =>
      adminApi.payouts({ partnerId: partnerId || undefined, pageSize: 50 }),
  });

  const summary = summaryQuery.data ?? [];
  const selected = useMemo(
    () => summary.find((s) => s.partnerId === partnerId),
    [summary, partnerId],
  );

  const create = useMutation({
    mutationFn: () =>
      adminApi.createPayout({
        partnerId,
        amount: Number(amount),
        periodStart: period.start,
        periodEnd: period.end,
        note: note || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payout-summary'] });
      qc.invalidateQueries({ queryKey: ['payouts'] });
      setAmount('');
      setNote('');
      toast.success('Repasse lançado.');
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : 'Falha ao lançar repasse.'),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!partnerId) {
      toast.error('Selecione um parceiro.');
      return;
    }
    if (!(Number(amount) > 0)) {
      toast.error('Informe um valor maior que zero.');
      return;
    }
    create.mutate();
  };

  const pick = (pid: string, available: number) => {
    setPartnerId(pid);
    setAmount(available > 0 ? available.toFixed(2) : '');
  };

  const history = historyQuery.data?.items ?? [];
  const stamp = new Date().toISOString().slice(0, 10);

  const exportCsv = () => {
    const rows = [
      'Resumo por parceiro',
      'Parceiro;Liquido resgatado;Ja repassado;Disponivel',
      ...summary.map((s) =>
        [
          csvCell(s.partnerName),
          csvCell(s.earnedNet.toFixed(2)),
          csvCell(s.paid.toFixed(2)),
          csvCell(s.available.toFixed(2)),
        ].join(';'),
      ),
      '',
      'Repasses lancados',
      'Data;Parceiro;Periodo inicio;Periodo fim;Valor;Observacao',
      ...history.map((p) =>
        [
          csvCell(new Date(p.createdAt).toLocaleDateString('pt-BR')),
          csvCell(p.partnerName),
          csvCell(new Date(p.periodStart).toLocaleDateString('pt-BR')),
          csvCell(new Date(p.periodEnd).toLocaleDateString('pt-BR')),
          csvCell(p.amount.toFixed(2)),
          csvCell(p.note),
        ].join(';'),
      ),
    ];
    downloadTextFile(
      `repasses-${stamp}.csv`,
      buildCsv(rows),
      'text/csv;charset=utf-8;',
    );
  };

  const exportPdf = () => {
    const summaryRows = summary
      .map(
        (s) =>
          `<tr><td>${htmlEscape(s.partnerName)}</td><td>${formatCurrency(
            s.earnedNet,
          )}</td><td>${formatCurrency(s.paid)}</td><td>${formatCurrency(
            s.available,
          )}</td></tr>`,
      )
      .join('');
    const historyRows = history
      .map(
        (p) =>
          `<tr><td>${new Date(p.createdAt).toLocaleDateString(
            'pt-BR',
          )}</td><td>${htmlEscape(p.partnerName)}</td><td>${new Date(
            p.periodStart,
          ).toLocaleDateString('pt-BR')} a ${new Date(
            p.periodEnd,
          ).toLocaleDateString('pt-BR')}</td><td>${formatCurrency(
            p.amount,
          )}</td><td>${htmlEscape(p.note)}</td></tr>`,
      )
      .join('');
    openPrintableReport(
      `repasses-${stamp}.pdf`,
      `<html><head><title>Repasses</title><style>
        body{font-family:Arial,sans-serif;padding:24px;color:#1f2937}
        h1{font-size:22px;margin:0 0 4px} h2{font-size:16px;margin:24px 0 8px}
        small{color:#6b7280}
        table{width:100%;border-collapse:collapse;margin-top:8px;font-size:13px}
        th,td{border:1px solid #d1d5db;padding:6px 8px;text-align:left}
        th{background:#f3f4f6}
      </style></head><body>
      <h1>Repasses a parceiros</h1>
      <small>OpenDriverHub · gerado em ${new Date().toLocaleString(
        'pt-BR',
      )}</small>
      <h2>Resumo por parceiro</h2>
      <table><thead><tr><th>Parceiro</th><th>Líquido resgatado</th>
      <th>Já repassado</th><th>Disponível</th></tr></thead><tbody>
      ${summaryRows || '<tr><td colspan="4">Sem dados</td></tr>'}</tbody></table>
      <h2>Repasses lançados</h2>
      <table><thead><tr><th>Data</th><th>Parceiro</th><th>Período</th>
      <th>Valor</th><th>Obs.</th></tr></thead><tbody>
      ${historyRows || '<tr><td colspan="5">Nenhum repasse lançado</td></tr>'}
      </tbody></table>
      <script>window.onload=()=>{window.print()}</script>
      </body></html>`,
    );
  };

  return (
    <div className="admin-page">
      <header className="admin-page__header">
        <div>
          <h2>Repasses a parceiros</h2>
          <p className="text-muted">
            Pagamentos em pacotes de 10 dias, creditados 10 dias depois. O
            valor lançado aqui é o que aparece como “Recebido” para o parceiro.
          </p>
        </div>
        <div className="row">
          <Button variant="secondary" onClick={exportCsv}>
            Exportar CSV
          </Button>
          <Button variant="secondary" onClick={exportPdf}>
            Exportar PDF
          </Button>
        </div>
      </header>

      <Card>
        <form className="stack" onSubmit={submit}>
          <h3>Lançar repasse</h3>
          <div className="input-field">
            <label className="input-field__label">Parceiro</label>
            <div className="input-field__box">
              <select
                className="input-field__el"
                value={partnerId}
                onChange={(e) => {
                  const s = summary.find(
                    (x) => x.partnerId === e.target.value,
                  );
                  pick(e.target.value, s?.available ?? 0);
                }}
              >
                <option value="">Selecione...</option>
                {summary.map((s) => (
                  <option key={s.partnerId} value={s.partnerId}>
                    {s.partnerName} — disponível{' '}
                    {formatCurrency(s.available)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {selected && (
            <p className="text-muted">
              Líquido resgatado: {formatCurrency(selected.earnedNet)} · Já
              repassado: {formatCurrency(selected.paid)} ·{' '}
              <strong>Disponível: {formatCurrency(selected.available)}</strong>
            </p>
          )}

          <div className="row">
            <Input
              label="Início do período"
              type="date"
              value={period.start}
              onChange={(e) =>
                setPeriod((p) => ({ ...p, start: e.target.value }))
              }
            />
            <Input
              label="Fim do período"
              type="date"
              value={period.end}
              onChange={(e) =>
                setPeriod((p) => ({ ...p, end: e.target.value }))
              }
            />
          </div>
          <Input
            label="Valor do repasse (R$)"
            inputMode="decimal"
            value={amount}
            onChange={(e) =>
              setAmount(e.target.value.replace(',', '.').replace(/[^\d.]/g, ''))
            }
          />
          <Input
            label="Observação (opcional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ex.: PIX enviado em 17/05"
          />
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? 'Lançando...' : 'Lançar repasse'}
          </Button>
        </form>
      </Card>

      <Card padded={false}>
        <QueryState
          loading={summaryQuery.isLoading}
          error={summaryQuery.error}
          empty={summary.length === 0}
          variant="list"
          emptyLabel="Nenhum parceiro."
        >
          <table className="history__table">
            <thead>
              <tr>
                <th>Parceiro</th>
                <th>Líquido resgatado</th>
                <th>Já repassado</th>
                <th>Disponível</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {summary.map((s) => (
                <tr key={s.partnerId}>
                  <td>
                    <strong>{s.partnerName}</strong>
                  </td>
                  <td>{formatCurrency(s.earnedNet)}</td>
                  <td>{formatCurrency(s.paid)}</td>
                  <td className="text-accent">
                    {formatCurrency(s.available)}
                  </td>
                  <td>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => pick(s.partnerId, s.available)}
                    >
                      Lançar
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </QueryState>
      </Card>

      <Card padded={false}>
        <QueryState
          loading={historyQuery.isLoading}
          error={historyQuery.error}
          empty={(historyQuery.data?.items.length ?? 0) === 0}
          variant="list"
          emptyLabel="Nenhum repasse lançado ainda."
        >
          <table className="history__table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Parceiro</th>
                <th>Período</th>
                <th>Valor</th>
                <th>Obs.</th>
              </tr>
            </thead>
            <tbody>
              {(historyQuery.data?.items ?? []).map((p) => (
                <tr key={p.id}>
                  <td>
                    {new Date(p.createdAt).toLocaleDateString('pt-BR')}
                  </td>
                  <td>{p.partnerName}</td>
                  <td>
                    {new Date(p.periodStart).toLocaleDateString('pt-BR')} —{' '}
                    {new Date(p.periodEnd).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="text-accent">{formatCurrency(p.amount)}</td>
                  <td>{p.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </QueryState>
      </Card>
    </div>
  );
}
