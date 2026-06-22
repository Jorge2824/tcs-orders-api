import { Request, Response, NextFunction } from 'express';
import { successResponse } from '../../../shared/utils/response.util';

export function createHttpHandler(
  statusCode: number,
  fn: (req: Request) => Promise<unknown>,
): (req: Request, res: Response, next: NextFunction) => Promise<void> {
  return async (req, res, next) => {
    try {
      const data = await fn(req);
      res.status(statusCode).json(successResponse(data));
    } catch (error) {
      next(error);
    }
  };
}
