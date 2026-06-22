import { OrderNotFoundException } from '../../domain/exceptions/order-not-found.exception';
import { InvalidOrderTransitionException } from '../../domain/exceptions/invalid-order-transition.exception';
import { ValidationException } from '../exceptions/validation.exception';
import { HTTP_STATUS } from '../constants/http-status.constants';

export interface MappedError {
  statusCode: number;
  message: string;
}

export function mapExceptionToResponse(error: unknown): MappedError {
  if (error instanceof ValidationException) {
    return { statusCode: HTTP_STATUS.BAD_REQUEST, message: error.message };
  }
  if (error instanceof OrderNotFoundException) {
    return { statusCode: HTTP_STATUS.NOT_FOUND, message: error.message };
  }
  if (error instanceof InvalidOrderTransitionException) {
    return { statusCode: HTTP_STATUS.CONFLICT, message: error.message };
  }
  return { statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR, message: 'Error interno del servidor' };
}
