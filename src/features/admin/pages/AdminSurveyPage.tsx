import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card } from '@shared/components/Card/Card';
import { Button } from '@shared/components/Button/Button';
import { StatCard } from '@shared/components/StatCard/StatCard';
import { QueryState } from '@shared/components/QueryState/QueryState';
import { useToast } from '@shared/components/Toaster/ToastContext';
import { formatDateTime, formatCurrency } from '@shared/utils/formatters';
import { adminApi, SurveyLead } from '@shared/api/endpoints';
import { downloadTextFile, buildCsv, csvCell } from '@shared/utils/exportReport';
import './AdminPages.css';

/** Pesquisa de opinião: pareamento do WhatsApp central (um só número, não é
 * por motorista) + métricas + lista de leads capturados (quem respondeu
 * "sem candidato" e deixou nome/telefone — cada telefone inédito paga o
 * motorista automaticamente, ver Survey:RewardAmount em Integrações). */
export function AdminSurveyPage() {
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  const toast = useToast();

  const summaryQuery = useQuery({
    queryKey: ['admin-survey-summary'],
    queryFn: () => adminApi.surveySummary(),
  });
  const q = useQuery({
    queryKey: ['admin-survey-leads', page],
    queryFn: () => adminApi.surveyLeads({ page, pageSize: 20 }),
  });
  const items = q.data?.items ?? [];
  const s = summaryQuery.data;

  const exportCsv = async () => {
    setExporting(true);
    try {
      const all = await adminApi.surveyLeads({ page: 1, pageSize: 5000 });
      const rows = [
        ['Nome', 'Telefone', 'Motorista', 'Pago', 'Valor (R$)', 'WhatsApp', 'Data'].map(csvCell).join(','),
        ...all.items.map((lead: SurveyLead) =>
          [
            csvCell(lead.name),
            csvCell(lead.phone),
            csvCell(lead.driverName ?? ''),
            csvCell(lead.rewarded ? 'Sim' : 'Não'),
            csvCell(lead.rewardAmount ? lead.rewardAmount.toFixed(2) : ''),
            csvCell(lead.whatsappStatus),
            csvCell(formatDateTime(lead.createdAt)),
          ].join(','),
        ),
      ];
      downloadTextFile('pesquisa-leads.csv', buildCsv(rows), 'text/csv;charset=utf-8');
    } catch {
      toast.error('Falha ao exportar CSV.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="admin-page">
      <header className="admin-page__header">
        <div>
          <h2>Pesquisa de opinião</h2>
          <p className="text-muted">
            Link pessoal do motorista → Formbricks. Quem responde "sem
            candidato" recebe o vídeo automaticamente pelo WhatsApp central
            abaixo, e o motorista que indicou recebe o valor configurado.
          </p>
        </div>
        <Button variant="secondary" onClick={exportCsv} disabled={exporting}>
          {exporting ? 'Exportando...' : 'Exportar CSV'}
        </Button>
      </header>

      {s && (
        <div className="partner-page__stats">
          <StatCard label="Total de respostas" value={String(s.totalLeads)} />
          <StatCard label="Contatos pagos" value={String(s.rewardedLeads)} />
          <StatCard label="Total pago" value={formatCurrency(s.totalPaid)} />
        </div>
      )}

      {s && s.topDrivers.length > 0 && (
        <Card>
          <h3>Ranking por motorista</h3>
          <table className="history__table" style={{ marginTop: 'var(--space-3)' }}>
            <thead>
              <tr>
                <th>Motorista</th>
                <th>Contatos pagos</th>
                <th>Total recebido</th>
              </tr>
            </thead>
            <tbody>
              {s.topDrivers.map((d) => (
                <tr key={d.driverId}>
                  <td>{d.driverName}</td>
                  <td>{d.leads}</td>
                  <td>{formatCurrency(d.paid)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <SurveyWhatsappCard />

      <Card padded={false}>
        <QueryState
          loading={q.isLoading}
          error={q.error}
          empty={items.length === 0}
          variant="list"
          emptyLabel="Nenhum contato capturado ainda."
        >
          <table className="history__table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Telefone</th>
                <th>Motorista de origem</th>
                <th>Pago</th>
                <th>WhatsApp</th>
                <th>Data</th>
              </tr>
            </thead>
            <tbody>
              {items.map((lead) => (
                <tr key={lead.id}>
                  <td>
                    <strong>{lead.name}</strong>
                  </td>
                  <td>{lead.phone}</td>
                  <td>{lead.driverName ?? '—'}</td>
                  <td>
                    {lead.rewarded ? (
                      <span className="badge badge-accent">{formatCurrency(lead.rewardAmount ?? 0)}</span>
                    ) : !lead.driverId ? (
                      <span className="badge">Sem motorista</span>
                    ) : (
                      <span className="badge">Duplicado</span>
                    )}
                  </td>
                  <td>
                    <span
                      className={`badge ${
                        lead.whatsappStatus === 'Sent'
                          ? 'badge-accent'
                          : lead.whatsappStatus === 'Failed'
                            ? 'badge-danger'
                            : 'badge-warning'
                      }`}
                    >
                      {lead.whatsappStatus === 'Sent'
                        ? 'Enviado'
                        : lead.whatsappStatus === 'Failed'
                          ? 'Falhou'
                          : 'Pendente'}
                    </span>
                  </td>
                  <td>{formatDateTime(lead.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </QueryState>
      </Card>

      {q.data && (
        <div className="admin-pagination">
          <span>
            Página {q.data.page} de {q.data.totalPages} - {q.data.total} contato(s)
          </span>
          <div className="row">
            <button type="button" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              Anterior
            </button>
            <button
              type="button"
              disabled={page >= q.data.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Próxima
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SurveyWhatsappCard() {
  const qc = useQueryClient();
  const toast = useToast();
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);

  const statusQuery = useQuery({
    queryKey: ['admin-survey-whatsapp-status'],
    queryFn: () => adminApi.surveyWhatsappStatus(),
    refetchInterval: polling ? 3000 : false,
  });

  const connected = statusQuery.data?.status === 'connected';

  useEffect(() => {
    if (connected) {
      setQrCode(null);
      setPolling(false);
    }
  }, [connected]);

  const connectMut = useMutation({
    mutationFn: () => adminApi.connectSurveyWhatsapp(),
    onSuccess: (data) => {
      if (data.status === 'connected') {
        toast.success('WhatsApp já estava conectado.');
        qc.invalidateQueries({ queryKey: ['admin-survey-whatsapp-status'] });
      } else if (data.qrCodeBase64) {
        setQrCode(data.qrCodeBase64);
        setPolling(true);
      }
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Falha ao gerar QR code.'),
  });

  const disconnectMut = useMutation({
    mutationFn: () => adminApi.disconnectSurveyWhatsapp(),
    onSuccess: () => {
      toast.success('WhatsApp desconectado.');
      qc.invalidateQueries({ queryKey: ['admin-survey-whatsapp-status'] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Falha ao desconectar.'),
  });

  return (
    <Card>
      <h3>WhatsApp central da pesquisa</h3>
      <p className="text-muted" style={{ marginTop: 'var(--space-1)' }}>
        Um número só, usado pra mandar o vídeo automaticamente pra quem
        responder "sem candidato" — pareie um número dedicado a essa
        campanha, não o seu pessoal.
      </p>

      <div style={{ marginTop: 'var(--space-3)' }}>
        {connected ? (
          <div className="row" style={{ alignItems: 'center' }}>
            <span className="badge badge-accent">WhatsApp conectado</span>
            <Button variant="secondary" onClick={() => disconnectMut.mutate()} disabled={disconnectMut.isPending}>
              Desconectar
            </Button>
          </div>
        ) : qrCode ? (
          <div className="stack" style={{ alignItems: 'center', textAlign: 'center' }}>
            <img src={qrCode} alt="QR code para conectar o WhatsApp" style={{ width: 220, height: 220 }} />
            <p className="text-muted">
              Abra o WhatsApp no celular → Aparelhos conectados → Conectar um
              aparelho, e escaneie este código. Expira em cerca de 1 minuto.
            </p>
            <Button variant="secondary" onClick={() => connectMut.mutate()} disabled={connectMut.isPending}>
              Gerar novo QR code
            </Button>
          </div>
        ) : (
          <Button onClick={() => connectMut.mutate()} disabled={connectMut.isPending}>
            {connectMut.isPending ? 'Gerando QR code...' : 'Conectar WhatsApp'}
          </Button>
        )}
      </div>
    </Card>
  );
}
