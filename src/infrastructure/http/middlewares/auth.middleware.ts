import { Request, Response, NextFunction } from 'express';
import { isValidBearerToken } from '../../../shared/utils/auth.util';
import { HTTP_STATUS } from '../../../shared/constants/http-status.constants';
import { errorResponse } from '../../../shared/utils/response.util';

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(HTTP_STATUS.UNAUTHORIZED).json(errorResponse('Encabezado de autorización ausente o inválido'));
    return;
  }

  const token = authHeader.split(' ')[1];
  if (!isValidBearerToken(token)) {
    res.status(HTTP_STATUS.UNAUTHORIZED).json(errorResponse('Token inválido'));
    return;
  }

  next();
}
