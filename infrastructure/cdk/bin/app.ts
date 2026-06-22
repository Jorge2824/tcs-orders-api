import * as cdk from 'aws-cdk-lib';
import { OrdersStack } from '../lib/orders-stack';

const app = new cdk.App();

new OrdersStack(app, 'TcsOrdersStack', {
  env: {
    account: process.env['CDK_DEFAULT_ACCOUNT'],
    region: process.env['CDK_DEFAULT_REGION'] ?? 'us-east-1',
  },
  description: 'TCS Orders API - Order processing platform for digital commerce',
});
