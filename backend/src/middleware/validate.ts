import type { NextFunction, Request, Response } from 'express';
import type { ZodType } from 'zod';

/** Valida req.body contra um schema zod, substituindo-o pelo valor parseado
 * (com defaults aplicados). Erros de validação viram 400 { error } via
 * errorHandler (ZodError). */
export function validateBody<T>(schema: ZodType<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    req.body = schema.parse(req.body);
    next();
  };
}
