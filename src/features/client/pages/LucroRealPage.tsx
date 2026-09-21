import { LucroRealCalculator } from '../components/LucroRealCalculator/LucroRealCalculator';
import { Icon } from '@shared/components/Icon/Icon';
import { usePageMeta } from '@shared/hooks/usePageMeta';
import './LucroRealPage.css';

/**
 * Landing dedicada: /lucro-real-motorista
 *
 * - Página pública (sem login).
 * - Hero curto + bloco "como funciona" com a copy oficial do briefing.
 * - Componente reutilizável faz o cálculo e a captura de lead.
 */
export function LucroRealPage() {
  usePageMeta(
    'Lucro Real do Motorista',
    'Calcule seu lucro real, custo por km e se o dia de corridas realmente compensou.',
  );
  return (
    <div className="lucro-page">
      <section className="lucro-page__hero">
        <div className="lucro-page__hero-copy">
          <span className="eyebrow">Open Driver · diagnóstico</span>
          <h1>
            <Icon name="car" size={30} /> Você sabe quanto realmente{' '}
            <span className="text-lime">lucrou hoje</span>?
          </h1>
          <p>
            Some tudo que recebeu na Uber, 99, Open Driver, corridas
            particulares e outros apps. Depois veja quanto gastou com
            combustível, manutenção, pneus, seguro, IPVA, financiamento,
            alimentação e depreciação do carro.
          </p>
          <p className="lucro-page__hero-sub">
            A Open Driver mostra seu <strong>lucro real</strong>, seu{' '}
            <strong>custo por km</strong> e se o dia realmente compensou.
          </p>
        </div>

        <aside className="lucro-page__hero-side">
          <ul>
            <li><Icon name="check" size={14} /> Faturamento total do dia</li>
            <li><Icon name="check" size={14} /> Custo real, custo por km</li>
            <li><Icon name="check" size={14} /> Lucro líquido e lucro por hora</li>
            <li><Icon name="check" size={14} /> Status: o dia compensou?</li>
          </ul>
        </aside>
      </section>

      <section className="lucro-page__form-card">
        <header>
          <h2>Calcular meu lucro real</h2>
          <p className="text-muted">
            Leva menos de 2 minutos. Seus dados ficam protegidos pela LGPD.
          </p>
        </header>

        <LucroRealCalculator
          intro="Preencha os campos abaixo com os números do seu dia. O cálculo é feito no seu próprio navegador — você só envia os dados se autorizar."
        />
      </section>
    </div>
  );
}
