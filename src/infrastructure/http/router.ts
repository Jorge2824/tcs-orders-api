import { Router } from 'express';
import { authMiddleware } from './middlewares/auth.middleware';
import { createOrderHandler, getOrderHandler, processOrderHandler } from './handlers/order.handler';

export const orderRouter = Router();

orderRouter.post('/orders', authMiddleware, createOrderHandler);
orderRouter.get('/orders/:id', authMiddleware, getOrderHandler);
orderRouter.post('/orders/:id/process', authMiddleware, processOrderHandler);
