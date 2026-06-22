export class OrderNotFoundException extends Error {
  constructor(id: string) {
    super(`Order '${id}' not found`);
    this.name = 'OrderNotFoundException';
  }
}
