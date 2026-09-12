import { z } from 'zod';

export const assistantLeadInputSchema = z.object({
  profile: z.string().optional(),
  category: z.string().optional(),
  goal: z.string().optional(),
  mainIntent: z.string().optional(),
  score: z.number().int().default(0),
  temperature: z.string(),
});
export type AssistantLeadInput = z.infer<typeof assistantLeadInputSchema>;

export interface AssistantLeadDto {
  id: string;
  lead: AssistantLeadInput;
  createdAt: Date;
}

export const botInteractionInputSchema = z.object({
  mensagemUsuario: z.string().default(''),
  respostaBot: z.string().default(''),
  etapaFluxo: z.string().default(''),
  leadId: z.string().uuid().optional().nullable(),
  lead: assistantLeadInputSchema,
});
export type BotInteractionInput = z.infer<typeof botInteractionInputSchema>;

export const chatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
});

export const assistantChatRequestSchema = z.object({
  messages: z.array(chatMessageSchema),
});
export type AssistantChatRequest = z.infer<typeof assistantChatRequestSchema>;

export interface AssistantChatResponse {
  reply: string;
  fallback: boolean;
}

export const lucroContactSchema = z.object({
  nome: z.string().optional(),
  whatsapp: z.string().optional(),
  cidade: z.string().optional(),
});

export const lucroConsentSchema = z.object({
  granted: z.boolean(),
  consentText: z.string().default(''),
  consentVersion: z.string().default(''),
});

export const lucroSubmissionSchema = z.object({
  contact: lucroContactSchema,
  consent: lucroConsentSchema,
  input: z.record(z.any()),
  result: z.record(z.any()),
  score: z.number().int(),
  temperature: z.string(),
});
export type LucroSubmissionInput = z.infer<typeof lucroSubmissionSchema>;

export interface LucroSubmissionDto {
  id: string;
  createdAt: Date;
}
