import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../errors.js';

/** Converte AppError (e erros de validação zod) em JSON { error }, igual ao
 * ExceptionMiddleware do .NET original. */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  if (err instanceof ZodError) {
    const message = err.issues[0]?.message ?? 'Dados inválidos.';
    res.status(400).json({ error: message });
    return;
  }
  console.error(err);
  res.status(500).json({ error: 'Erro interno do servidor.' });
}
