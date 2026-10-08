import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { adminApi } from '@shared/api/endpoints';
import './PaymentModeBanner.css';

/**
 * Faixa de aviso: o pagamento está simulado.
 *
 * Por que existe, e por que fica no layout e não numa tela só: com o provedor em `mock`, o
 * sistema **finge** que cobra — o Pix gera um QR falso e a cobrança é aprovada sozinha depois
 * de 5 minutos. Até aqui essa diferença não aparecia em lugar nenhum da interface, e o pior
 * modo de descobrir é semanas depois, olhando um relatório de vendas que nunca virou dinheiro.
 *
 * Fica no `AdminLayout`, então acompanha qualquer tela administrativa. Um aviso que mora só na
 * tela de Integrações só é visto por quem já foi conferir — ou seja, por quem já suspeitava.
 *
 * Em silêncio quando o provedor é real: aviso que aparece sempre deixa de ser aviso.
 */
export function PaymentModeBanner() {
  const q = useQuery({
    queryKey: ['admin-payment-mode'],
    queryFn: () => adminApi.paymentMode(),
    // Estado de configuração, não dado operacional: não vale reconsultar a cada navegação.
    staleTime: 5 * 60_000,
    // Sem retry e em silêncio no erro: é um aviso. Falhar a leitura não deve encher a tela de
    // mensagem de erro sobre uma faixa que o operador talvez nem precise ver.
    retry: false,
  });

  if (!q.data?.warning) return null;

  return (
    <div className="payment-banner" role="alert">
      <strong>Pagamento simulado</strong>
      <span>{q.data.warning}</span>
      <Link to="/admin/integracoes">Configurar</Link>
    </div>
  );
}
