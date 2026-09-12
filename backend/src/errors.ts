/** Erro de negócio com status HTTP associado (equivalente ao AppException do .NET). */
export class AppError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}
