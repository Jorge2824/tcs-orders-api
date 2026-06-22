export interface OrderQueuePort {
  enqueue(orderId: string): Promise<void>;
}
