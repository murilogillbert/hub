import { z } from 'zod';

/**
 * Regra de senha, em um lugar só.
 *
 * É a MESMA do OpenDriver (`opendriver/backend/src/modules/auth/auth.service.ts`, `passwordSchema`)
 * de propósito: os dois serviços gravam no mesmo `users.password_hash`, então uma regra mais fraca
 * aqui significaria conta criada no hub que o outro app recusaria ao trocar a senha.
 *
 * Vale só na CRIAÇÃO e na TROCA. Contas antigas com senha mais curta continuam entrando
 * normalmente — o login não revalida a regra, e não há redefinição forçada.
 */
export const PASSWORD_MIN_LENGTH = 8;

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `A senha precisa ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`)
  .max(128, 'Senha longa demais.')
  .regex(/[A-Za-z]/, 'A senha precisa ter pelo menos uma letra.')
  .regex(/\d/, 'A senha precisa ter pelo menos um número.');

/** Mesma validação fora do zod (serviços que checam senha sem passar por schema). */
export function passwordProblem(value: string): string | null {
  const result = passwordSchema.safeParse(value);
  return result.success ? null : (result.error.issues[0]?.message ?? 'Senha inválida.');
}
