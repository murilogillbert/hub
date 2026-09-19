import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card } from '@shared/components/Card/Card';
import { Button } from '@shared/components/Button/Button';
import { StatCard } from '@shared/components/StatCard/StatCard';
import { QueryState } from '@shared/components/QueryState/QueryState';
import { useToast } from '@shared/components/Toaster/ToastContext';
import { affiliateApi } from '@shared/api/endpoints';
import { SERVER_ORIGIN } from '@shared/api/client';
import '../PartnerPages.css';

export function AffiliateLinkPage() {
  const q = useQuery({ queryKey: ['affiliate-link'], queryFn: () => affiliateApi.link() });
  const [copied, setCopied] = useState(false);

  const link = q.data?.code ? `${SERVER_ORIGIN}/r/${q.data.code}` : '';

  const copy = async () => {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="partner-page">
      <header className="partner-page__header">
        <div>
          <h2>Meu link de indicação</h2>
          <p className="text-muted">
            Envie este link para quem quiser fazer um orçamento de energia
            solar — as visitas e cotações geradas por ele ficam contadas aqui.
          </p>
        </div>
      </header>

      <QueryState loading={q.isLoading} error={q.error} empty={false}>
        <Card>
          <div className="row">
            <code style={{ flex: 1, wordBreak: 'break-all' }}>{link || 'Link ainda não disponível.'}</code>
            <Button onClick={copy} disabled={!link}>
              {copied ? 'Copiado!' : 'Copiar link'}
            </Button>
          </div>
        </Card>

        <div className="partner-page__stats">
          <StatCard label="Cliques" value={String(q.data?.linkViews ?? 0)} />
          <StatCard label="Cotações geradas" value={String(q.data?.linkLeads ?? 0)} />
          <StatCard label="Vendas" value={String(q.data?.linkSales ?? 0)} />
        </div>
      </QueryState>

      <WhatsAppConnectCard />
    </div>
  );
}

function WhatsAppConnectCard() {
  const qc = useQueryClient();
  const toast = useToast();
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);

  const statusQuery = useQuery({
    queryKey: ['affiliate-whatsapp-status'],
    queryFn: () => affiliateApi.whatsappStatus(),
    refetchInterval: polling ? 3000 : false,
  });

  const connected = statusQuery.data?.status === 'connected';

  // Assim que conecta, para de exibir o QR e o polling.
  useEffect(() => {
    if (connected) {
      setQrCode(null);
      setPolling(false);
    }
  }, [connected]);

  const connectMut = useMutation({
    mutationFn: () => affiliateApi.connectWhatsApp(),
    onSuccess: (data) => {
      if (data.status === 'connected') {
        toast.success('WhatsApp já estava conectado.');
        qc.invalidateQueries({ queryKey: ['affiliate-whatsapp-status'] });
      } else if (data.qrCodeBase64) {
        setQrCode(data.qrCodeBase64);
        setPolling(true);
      }
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Falha ao gerar QR code.'),
  });

  const disconnectMut = useMutation({
    mutationFn: () => affiliateApi.disconnectWhatsApp(),
    onSuccess: () => {
      toast.success('WhatsApp desconectado.');
      qc.invalidateQueries({ queryKey: ['affiliate-whatsapp-status'] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Falha ao desconectar.'),
  });

  return (
    <Card>
      <h3>WhatsApp para envio de propostas</h3>
      <p className="text-muted" style={{ marginTop: 'var(--space-1)' }}>
        Conecte o WhatsApp que você usa com os clientes — é pra esse número
        que a proposta em PDF do orçamento solar é enviada automaticamente.
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
