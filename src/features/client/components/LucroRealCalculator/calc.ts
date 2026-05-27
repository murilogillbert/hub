/**
 * Calculadora de Lucro Real do Motorista — funções puras.
 *
 * Modelo fiel ao briefing: depreciação anual 10% do valor do carro, 26 dias de
 * trabalho/mês, lavagem em 6 dias úteis na semana. Tudo proporcional ao dia.
 */

export interface LucroInput {
  // Ganhos do dia
  uber: number;
  novenove: number;
  openDriver: number;
  particular: number;
  outros: number;
  // Trabalho do dia
  horas: number;
  km: number;
  // Dados do carro
  valorCarro: number;
  consumo: number;          // km/l
  precoCombustivel: number; // R$/litro
  // Custos fixos
  manutencaoMensal: number;
  seguroMensal: number;
  ipvaAnual: number;
  financiamentoMensal: number;
  internetMensal: number;
  alimentacaoDia: number;
  lavagemSemanal: number;
}

export type LucroStatus =
  | 'prejuizo'
  | 'muito_baixa'
  | 'apertada'
  | 'boa'
  | 'excelente';

export interface LucroResult {
  receitaTotal: number;
  combustivel: number;
  depreciacaoDia: number;
  manutencaoDia: number;
  seguroDia: number;
  ipvaDia: number;
  financiamentoDia: number;
  internetDia: number;
  alimentacaoDia: number;
  lavagemDia: number;
  custoTotal: number;
  lucroReal: number;
  lucroHora: number;
  lucroKm: number;
  custoKm: number;
  status: LucroStatus;
}

/** Constantes do modelo (extraídas do briefing — mantidas explícitas). */
export const DIAS_TRABALHO_MES = 26;
export const DIAS_TRABALHO_ANO = DIAS_TRABALHO_MES * 12; // 312
export const DEPRECIACAO_ANUAL_PCT = 0.1;
export const DIAS_LAVAGEM_SEMANA = 6;

export const STATUS_LABEL: Record<LucroStatus, string> = {
  prejuizo: 'Prejuízo real',
  muito_baixa: 'Compensação muito baixa',
  apertada: 'Compensação apertada',
  boa: 'Compensação boa',
  excelente: 'Excelente resultado',
};

export function calcularLucroReal(i: LucroInput): LucroResult {
  const receitaTotal =
    i.uber + i.novenove + i.openDriver + i.particular + i.outros;

  const combustivel =
    i.consumo > 0 ? (i.km / i.consumo) * i.precoCombustivel : 0;

  // Depreciação: 10%/ano do valor do carro, distribuído pelos km estimados
  // no ano (km do dia × 312). Equivalente a depreciacao_anual × km_dia/km_ano.
  const kmAnoEstimado = i.km * DIAS_TRABALHO_ANO;
  const depreciacaoAnual = i.valorCarro * DEPRECIACAO_ANUAL_PCT;
  const depreciacaoPorKm =
    kmAnoEstimado > 0 ? depreciacaoAnual / kmAnoEstimado : 0;
  const depreciacaoDia = depreciacaoPorKm * i.km;

  const manutencaoDia = i.manutencaoMensal / DIAS_TRABALHO_MES;
  const seguroDia = i.seguroMensal / DIAS_TRABALHO_MES;
  const ipvaDia = i.ipvaAnual / DIAS_TRABALHO_ANO;
  const financiamentoDia = i.financiamentoMensal / DIAS_TRABALHO_MES;
  const internetDia = i.internetMensal / DIAS_TRABALHO_MES;
  const alimentacaoDia = i.alimentacaoDia;
  const lavagemDia = i.lavagemSemanal / DIAS_LAVAGEM_SEMANA;

  const custoTotal =
    combustivel +
    depreciacaoDia +
    manutencaoDia +
    seguroDia +
    ipvaDia +
    financiamentoDia +
    internetDia +
    alimentacaoDia +
    lavagemDia;

  const lucroReal = receitaTotal - custoTotal;
  const lucroHora = i.horas > 0 ? lucroReal / i.horas : 0;
  const lucroKm = i.km > 0 ? lucroReal / i.km : 0;
  const custoKm = i.km > 0 ? custoTotal / i.km : 0;

  const status = classificar(lucroReal, lucroHora);

  return {
    receitaTotal,
    combustivel,
    depreciacaoDia,
    manutencaoDia,
    seguroDia,
    ipvaDia,
    financiamentoDia,
    internetDia,
    alimentacaoDia,
    lavagemDia,
    custoTotal,
    lucroReal,
    lucroHora,
    lucroKm,
    custoKm,
    status,
  };
}

function classificar(lucroReal: number, lucroHora: number): LucroStatus {
  if (lucroReal < 0) return 'prejuizo';
  if (lucroHora < 15) return 'muito_baixa';
  if (lucroHora < 25) return 'apertada';
  if (lucroHora < 40) return 'boa';
  return 'excelente';
}

export const EMPTY_LUCRO_INPUT: LucroInput = {
  uber: 0,
  novenove: 0,
  openDriver: 0,
  particular: 0,
  outros: 0,
  horas: 0,
  km: 0,
  valorCarro: 0,
  consumo: 0,
  precoCombustivel: 0,
  manutencaoMensal: 0,
  seguroMensal: 0,
  ipvaAnual: 0,
  financiamentoMensal: 0,
  internetMensal: 0,
  alimentacaoDia: 0,
  lavagemSemanal: 0,
};

/** Pontuação 0–100 a partir do lucro/hora — usada para temperatura do lead. */
export function scoreFromLucroHora(lucroHora: number): number {
  if (lucroHora <= 0) return 5;
  if (lucroHora >= 60) return 95;
  return Math.round((lucroHora / 60) * 95);
}

export function temperatureFromScore(score: number): 'cold' | 'warm' | 'hot' {
  if (score >= 70) return 'hot';
  if (score >= 35) return 'warm';
  return 'cold';
}
