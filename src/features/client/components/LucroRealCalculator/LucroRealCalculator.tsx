import { useMemo, useState } from 'react';
import { Input } from '@shared/components/Input/Input';
import { Button } from '@shared/components/Button/Button';
import { formatCurrency } from '@shared/utils/formatters';
import { assistantApi } from '@shared/api/endpoints';
import {
  LucroInput,
  LucroResult,
  EMPTY_LUCRO_INPUT,
  STATUS_LABEL,
  calcularLucroReal,
  scoreFromLucroHora,
  temperatureFromScore,
} from './calc';
import './LucroRealCalculator.css';

interface LucroRealCalculatorProps {
  /** Número de WhatsApp para o CTA final (sem máscara, ex.: 5511999999999). */
  whatsappNumber?: string;
  /** Texto opcional acima do form. */
  intro?: string;
}

export function LucroRealCalculator({
  whatsappNumber = '5511999999999',
  intro,
}: LucroRealCalculatorProps) {
  const [form, setForm] = useState<LucroInput>(EMPTY_LUCRO_INPUT);
  const [contato, setContato] = useState({ nome: '', whatsapp: '', cidade: '' });
  const [consentimento, setConsentimento] = useState(false);
  const [result, setResult] = useState<LucroResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const set = (key: keyof LucroInput) => (v: string) =>
    setForm((prev) => ({ ...prev, [key]: parseFloat(v) || 0 }));

  const podeEnviar = useMemo(
    () => consentimento && (form.uber + form.novenove + form.openDriver + form.particular + form.outros) > 0,
    [consentimento, form],
  );

  async function handleCalcular(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (!consentimento) {
      setErro('Você precisa autorizar o uso dos dados para continuar.');
      return;
    }
    setSubmitting(true);
    const r = calcularLucroReal(form);
    setResult(r);

    // Captura de lead (fase 1 — reaproveita o pipeline do assistente).
    // Falha silenciosa: não trava o resultado se o back estiver indisponível.
    try {
      const score = scoreFromLucroHora(r.lucroHora);
      await assistantApi.createLead({
        source: 'lucro_real',
        profile: 'motorista',
        category: 'lucro_real',
        goal: 'auto_diagnostico',
        mainIntent: 'descobrir_se_compensa',
        score,
        temperature: temperatureFromScore(score),
        contact: contato,
        payload: { input: form, result: r },
      });
    } catch {
      /* ignore — diagnostico local já está pronto */
    } finally {
      setSubmitting(false);
      // Rolagem suave até o resultado.
      requestAnimationFrame(() => {
        document
          .getElementById('lucro-real-resultado')
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  }

  function handleReset() {
    setForm(EMPTY_LUCRO_INPUT);
    setContato({ nome: '', whatsapp: '', cidade: '' });
    setConsentimento(false);
    setResult(null);
    setErro(null);
  }

  return (
    <div className="lucro-calc">
      {intro && <p className="lucro-calc__intro">{intro}</p>}

      <form className="lucro-calc__form" onSubmit={handleCalcular}>
        <fieldset className="lucro-calc__group">
          <legend>Seus dados</legend>
          <div className="lucro-calc__grid">
            <Input
              label="Nome"
              value={contato.nome}
              onChange={(e) => setContato((p) => ({ ...p, nome: e.target.value }))}
              placeholder="Como podemos te chamar?"
            />
            <Input
              label="WhatsApp"
              value={contato.whatsapp}
              onChange={(e) => setContato((p) => ({ ...p, whatsapp: e.target.value }))}
              placeholder="(11) 99999-9999"
              inputMode="tel"
            />
            <Input
              label="Cidade"
              value={contato.cidade}
              onChange={(e) => setContato((p) => ({ ...p, cidade: e.target.value }))}
              placeholder="Cidade/UF"
            />
          </div>
        </fieldset>

        <fieldset className="lucro-calc__group">
          <legend>Ganhos do dia</legend>
          <div className="lucro-calc__grid">
            <Input label="Receita Uber (R$)" type="number" step="0.01" inputMode="decimal"
              value={form.uber || ''} onChange={(e) => set('uber')(e.target.value)} />
            <Input label="Receita 99 (R$)" type="number" step="0.01" inputMode="decimal"
              value={form.novenove || ''} onChange={(e) => set('novenove')(e.target.value)} />
            <Input label="Receita Open Driver (R$)" type="number" step="0.01" inputMode="decimal"
              value={form.openDriver || ''} onChange={(e) => set('openDriver')(e.target.value)} />
            <Input label="Corridas particulares (R$)" type="number" step="0.01" inputMode="decimal"
              value={form.particular || ''} onChange={(e) => set('particular')(e.target.value)} />
            <Input label="Outros apps (R$)" type="number" step="0.01" inputMode="decimal"
              value={form.outros || ''} onChange={(e) => set('outros')(e.target.value)} />
          </div>
        </fieldset>

        <fieldset className="lucro-calc__group">
          <legend>Trabalho do dia</legend>
          <div className="lucro-calc__grid">
            <Input label="Horas trabalhadas" type="number" step="0.1" inputMode="decimal"
              value={form.horas || ''} onChange={(e) => set('horas')(e.target.value)} />
            <Input label="Km rodados no total" type="number" step="0.1" inputMode="decimal"
              value={form.km || ''} onChange={(e) => set('km')(e.target.value)} />
          </div>
        </fieldset>

        <fieldset className="lucro-calc__group">
          <legend>Dados do carro</legend>
          <div className="lucro-calc__grid">
            <Input label="Valor aproximado do carro (R$)" type="number" step="0.01" inputMode="decimal"
              value={form.valorCarro || ''} onChange={(e) => set('valorCarro')(e.target.value)} />
            <Input label="Consumo médio (km/l)" type="number" step="0.1" inputMode="decimal"
              value={form.consumo || ''} onChange={(e) => set('consumo')(e.target.value)} />
            <Input label="Preço do combustível (R$/litro)" type="number" step="0.01" inputMode="decimal"
              value={form.precoCombustivel || ''} onChange={(e) => set('precoCombustivel')(e.target.value)} />
          </div>
        </fieldset>

        <fieldset className="lucro-calc__group">
          <legend>Custos fixos</legend>
          <div className="lucro-calc__grid">
            <Input label="Manutenção mensal (R$)" type="number" step="0.01" inputMode="decimal"
              value={form.manutencaoMensal || ''} onChange={(e) => set('manutencaoMensal')(e.target.value)} />
            <Input label="Seguro mensal (R$)" type="number" step="0.01" inputMode="decimal"
              value={form.seguroMensal || ''} onChange={(e) => set('seguroMensal')(e.target.value)} />
            <Input label="IPVA/licenciamento anual (R$)" type="number" step="0.01" inputMode="decimal"
              value={form.ipvaAnual || ''} onChange={(e) => set('ipvaAnual')(e.target.value)} />
            <Input label="Financiamento/aluguel mensal (R$)" type="number" step="0.01" inputMode="decimal"
              value={form.financiamentoMensal || ''} onChange={(e) => set('financiamentoMensal')(e.target.value)} />
            <Input label="Internet/celular mensal (R$)" type="number" step="0.01" inputMode="decimal"
              value={form.internetMensal || ''} onChange={(e) => set('internetMensal')(e.target.value)} />
            <Input label="Alimentação do dia (R$)" type="number" step="0.01" inputMode="decimal"
              value={form.alimentacaoDia || ''} onChange={(e) => set('alimentacaoDia')(e.target.value)} />
            <Input label="Lavagem semanal (R$)" type="number" step="0.01" inputMode="decimal"
              value={form.lavagemSemanal || ''} onChange={(e) => set('lavagemSemanal')(e.target.value)} />
          </div>
        </fieldset>

        <label className="lucro-calc__lgpd">
          <input
            type="checkbox"
            checked={consentimento}
            onChange={(e) => setConsentimento(e.target.checked)}
          />
          <span>
            Autorizo a Open Driver a utilizar meus dados para calcular meu
            resultado econômico, gerar diagnóstico personalizado e enviar
            comunicações pelo WhatsApp sobre benefícios, economia e
            oportunidades para motoristas.
          </span>
        </label>

        {erro && <p className="lucro-calc__err">{erro}</p>}

        <div className="lucro-calc__actions">
          <Button type="submit" size="lg" disabled={!podeEnviar || submitting}>
            {submitting ? 'Calculando...' : 'Calcular meu lucro real'}
          </Button>
          {result && (
            <Button type="button" variant="ghost" onClick={handleReset}>
              Limpar
            </Button>
          )}
        </div>
      </form>

      {result && (
        <LucroResultBlock
          result={result}
          whatsappNumber={whatsappNumber}
          contato={contato}
        />
      )}
    </div>
  );
}

function LucroResultBlock({
  result,
  whatsappNumber,
  contato,
}: {
  result: LucroResult;
  whatsappNumber: string;
  contato: { nome: string; cidade: string };
}) {
  const waMessage = encodeURIComponent(
    `Olá! Sou ${contato.nome || 'motorista'}${contato.cidade ? ` de ${contato.cidade}` : ''}. ` +
      `Acabei de usar a calculadora de lucro real da Open Driver:\n` +
      `• Faturamento: ${formatCurrency(result.receitaTotal)}\n` +
      `• Custo real: ${formatCurrency(result.custoTotal)}\n` +
      `• Lucro real: ${formatCurrency(result.lucroReal)}\n` +
      `• Lucro/hora: ${formatCurrency(result.lucroHora)}\n` +
      `Quero economizar mais com a Open Driver.`,
  );

  const statusClass = `lucro-calc__status lucro-calc__status--${result.status}`;

  return (
    <section id="lucro-real-resultado" className="lucro-calc__result">
      <header className="lucro-calc__result-head">
        <h3>Resultado global do dia</h3>
        <span className={statusClass}>{STATUS_LABEL[result.status]}</span>
      </header>

      <div className="lucro-calc__cards">
        <ResultCard label="Faturamento total" value={result.receitaTotal} tone="info" />
        <ResultCard label="Custo real estimado" value={result.custoTotal} tone="warn" />
        <ResultCard
          label="Lucro real"
          value={result.lucroReal}
          tone={result.lucroReal >= 0 ? 'good' : 'bad'}
          big
        />
        <ResultCard label="Lucro por hora" value={result.lucroHora} tone="good" />
      </div>

      <div className="lucro-calc__minor">
        <MinorItem label="Lucro por km" value={formatCurrency(result.lucroKm)} />
        <MinorItem label="Custo por km" value={formatCurrency(result.custoKm)} />
        <MinorItem
          label="Depreciação do dia"
          value={formatCurrency(result.depreciacaoDia)}
        />
        <MinorItem
          label="Combustível"
          value={formatCurrency(result.combustivel)}
        />
      </div>

      <div className="lucro-calc__cta">
        <a
          className="btn btn--primary btn--lg"
          href={`https://wa.me/${whatsappNumber}?text=${waMessage}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Quero economizar mais com a Open Driver
        </a>
        <a className="btn btn--secondary btn--lg" href="/produtos">
          Ver descontos e parceiros
        </a>
      </div>

      <details className="lucro-calc__breakdown">
        <summary>Detalhe dos custos do dia</summary>
        <ul>
          <li>Combustível: {formatCurrency(result.combustivel)}</li>
          <li>Depreciação: {formatCurrency(result.depreciacaoDia)}</li>
          <li>Manutenção: {formatCurrency(result.manutencaoDia)}</li>
          <li>Seguro: {formatCurrency(result.seguroDia)}</li>
          <li>IPVA: {formatCurrency(result.ipvaDia)}</li>
          <li>Financiamento: {formatCurrency(result.financiamentoDia)}</li>
          <li>Internet/celular: {formatCurrency(result.internetDia)}</li>
          <li>Alimentação: {formatCurrency(result.alimentacaoDia)}</li>
          <li>Lavagem: {formatCurrency(result.lavagemDia)}</li>
        </ul>
      </details>
    </section>
  );
}

function ResultCard({
  label,
  value,
  tone,
  big,
}: {
  label: string;
  value: number;
  tone: 'info' | 'good' | 'warn' | 'bad';
  big?: boolean;
}) {
  return (
    <div
      className={`lucro-calc__card lucro-calc__card--${tone} ${big ? 'is-big' : ''}`}
    >
      <small>{label}</small>
      <strong>{formatCurrency(value)}</strong>
    </div>
  );
}

function MinorItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="lucro-calc__minor-item">
      <small>{label}</small>
      <strong>{value}</strong>
    </div>
  );
}
