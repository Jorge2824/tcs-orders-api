import { Request, Response, NextFunction } from 'express';
import { mapExceptionToResponse } from '../../../shared/utils/exception-mapper.util';
import { errorResponse } from '../../../shared/utils/response.util';

export function errorMiddleware(error: Error, _req: Request, res: Response, _next: NextFunction): void {
  const { statusCode, message } = mapExceptionToResponse(error);
  if (statusCode === 500) console.error('[ERROR]', error.message);
  res.status(statusCode).json(errorResponse(message));
}
