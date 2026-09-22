import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card } from '@shared/components/Card/Card';
import { Button } from '@shared/components/Button/Button';
import { QueryState } from '@shared/components/QueryState/QueryState';
import { useToast } from '@shared/components/Toaster/ToastContext';
import { formatDateTime } from '@shared/utils/formatters';
import { adminApi } from '@shared/api/endpoints';
import './AdminPages.css';

/** Pesquisa de opinião: pareamento do WhatsApp central (um só número, não é
 * por motorista) + lista de leads capturados (quem respondeu "sem
 * candidato" e deixou nome/telefone). */
export function AdminSurveyPage() {
  const [page, setPage] = useState(1);
  const q = useQuery({
    queryKey: ['admin-survey-leads', page],
    queryFn: () => adminApi.surveyLeads({ page, pageSize: 20 }),
  });
  const items = q.data?.items ?? [];

  return (
    <div className="admin-page">
      <header className="admin-page__header">
        <div>
          <h2>Pesquisa de opinião</h2>
          <p className="text-muted">
            Link pessoal do motorista → Formbricks. Quem responde "sem
            candidato" recebe o vídeo automaticamente pelo WhatsApp central
            abaixo.
          </p>
        </div>
      </header>

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
