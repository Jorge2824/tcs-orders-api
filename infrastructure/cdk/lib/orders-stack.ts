import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaNode from 'aws-cdk-lib/aws-lambda-nodejs';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

const ROOT = path.join(__dirname, '../../..');
const SRC = path.join(ROOT, 'src');

export class OrdersStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const ordersTable = new dynamodb.Table(this, 'OrdersTable', {
      tableName: 'orders',
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
    });

    const auditLogsTable = new dynamodb.Table(this, 'AuditLogsTable', {
      tableName: 'audit_logs',
      partitionKey: { name: 'orderId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const deadLetterQueue = new sqs.Queue(this, 'OrdersDLQ', {
      queueName: 'orders-dlq',
      retentionPeriod: cdk.Duration.days(14),
    });

    const ordersQueue = new sqs.Queue(this, 'OrdersQueue', {
      queueName: 'orders-queue',
      visibilityTimeout: cdk.Duration.seconds(60),
      deadLetterQueue: {
        queue: deadLetterQueue,
        maxReceiveCount: 3,
      },
    });

    const sharedEnv: Record<string, string> = {
      ORDERS_TABLE_NAME: ordersTable.tableName,
      AUDIT_LOGS_TABLE_NAME: auditLogsTable.tableName,
      ORDERS_QUEUE_URL: ordersQueue.queueUrl,
      BEARER_TOKEN: process.env['BEARER_TOKEN'] ?? 'dev-secret-token',
      AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1',
    };

    const bundling: lambdaNode.BundlingOptions = {
      minify: false,
      sourceMap: false,
      target: 'node20',
      externalModules: [],
    };

    const nodejsDefaults = {
      runtime: lambda.Runtime.NODEJS_20_X,
      projectRoot: ROOT,
      depsLockFilePath: path.join(ROOT, 'package-lock.json'),
      bundling,
      environment: sharedEnv,
      memorySize: 256,
    };

    // NodejsFunction usa esbuild: empaqueta el TS + todas las dependencias
    // en un único archivo JS sin necesitar dist/ ni node_modules en el deploy.
    const apiFn = new lambdaNode.NodejsFunction(this, 'OrdersApiFn', {
      ...nodejsDefaults,
      entry: path.join(SRC, 'infrastructure/lambda/index.ts'),
      handler: 'handler',
      timeout: cdk.Duration.seconds(29),
      description: 'App Express envuelta con serverless-http — idéntica al entorno local',
    });

    const sqsProcessorFn = new lambdaNode.NodejsFunction(this, 'SqsProcessorFn', {
      ...nodejsDefaults,
      entry: path.join(SRC, 'infrastructure/lambda/handlers/sqs-processor.handler.ts'),
      handler: 'handler',
      timeout: cdk.Duration.seconds(60),
      description: 'Consumidor SQS — procesa órdenes de forma asíncrona',
    });

    ordersTable.grantReadWriteData(apiFn);
    ordersTable.grantReadWriteData(sqsProcessorFn);

    auditLogsTable.grantReadWriteData(apiFn);
    auditLogsTable.grantReadWriteData(sqsProcessorFn);

    ordersQueue.grantSendMessages(apiFn);

    sqsProcessorFn.addEventSource(
      new lambdaEventSources.SqsEventSource(ordersQueue, {
        batchSize: 10,
        maxConcurrency: 5,
      }),
    );

    const api = new apigateway.RestApi(this, 'OrdersApi', {
      restApiName: 'TCS Orders API',
      description: 'Plataforma de procesamiento de órdenes — TCS',
      deployOptions: { stageName: 'v1' },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: ['GET', 'POST', 'OPTIONS'],
        allowHeaders: ['Content-Type', 'Authorization'],
      },
    });

    const integration = new apigateway.LambdaIntegration(apiFn, { proxy: true });

    api.root.addResource('health').addMethod('GET', integration);

    const orders = api.root.addResource('orders');
    orders.addMethod('POST', integration);

    const order = orders.addResource('{id}');
    order.addMethod('GET', integration);
    order.addResource('process').addMethod('POST', integration);

    apiFn.addPermission('ApiGatewayInvoke', {
      principal: new iam.ServicePrincipal('apigateway.amazonaws.com'),
      sourceArn: api.arnForExecuteApi('*', '/*', '*'),
    });

    new cdk.CfnOutput(this, 'ApiGatewayUrl', {
      value: api.url,
      description: 'URL base de API Gateway',
    });

    new cdk.CfnOutput(this, 'OrdersQueueUrl', {
      value: ordersQueue.queueUrl,
      description: 'URL de la cola SQS de órdenes',
    });
  }
}
