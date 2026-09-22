import * as surveyLeadService from '../services/surveyLeadService.js';

/** Despacha os vídeos agendados da pesquisa de opinião (os 4 por lead,
 * espaçados 28-32min entre si — ver surveyLeadService.scheduleVideoDeliveries)
 * assim que o horário de cada um chegar. Mesmo padrão do
 * paymentReconciliation.ts (setInterval, processo persistente). */
export function startSurveyVideoDispatch(): NodeJS.Timeout {
  const tick = async (): Promise<void> => {
    try {
      await surveyLeadService.dispatchDueVideos();
    } catch (err) {
      console.warn('Falha ao despachar vídeos da pesquisa de opinião', err);
    }
  };
  void tick();
  return setInterval(tick, 60_000);
}
