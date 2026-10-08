import { z } from 'zod';

export interface IntegrationFieldDto {
  key: string;
  label: string;
  secret: boolean;
  hasValue: boolean;
  preview: string;
  source: 'db' | 'env' | 'unset';
  /** Quando presente, o campo é uma escolha: a tela mostra um seletor, não caixa de texto. */
  options?: string[];
  /** Explicação curta sob o campo, para o operador não precisar adivinhar o efeito. */
  hint?: string;
}

export interface IntegrationGroupDto {
  id: string;
  name: string;
  description: string;
  icon: string;
  connected: boolean;
  /**
   * Alerta do grupo, exibido em destaque. Hoje só o grupo de pagamento usa: enquanto o
   * provedor é `mock`, o sistema finge que cobra, e isso precisa aparecer na tela.
   */
  warning: string | null;
  fields: IntegrationFieldDto[];
}

export const updateSettingSchema = z.object({
  key: z.string().min(1),
  value: z.string().optional().nullable(),
});
export type UpdateSettingRequest = z.infer<typeof updateSettingSchema>;
