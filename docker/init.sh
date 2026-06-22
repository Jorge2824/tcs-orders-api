#!/bin/sh
set -e

echo "Creating DynamoDB tables..."

aws dynamodb create-table \
  --table-name orders \
  --attribute-definitions AttributeName=id,AttributeType=S \
  --key-schema AttributeName=id,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --endpoint-url http://dynamodb-local:8000

aws dynamodb create-table \
  --table-name audit_logs \
  --attribute-definitions \
    AttributeName=orderId,AttributeType=S \
    AttributeName=timestamp,AttributeType=S \
  --key-schema \
    AttributeName=orderId,KeyType=HASH \
    AttributeName=timestamp,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST \
  --endpoint-url http://dynamodb-local:8000

echo "DynamoDB tables ready. SQS queue is pre-configured via elasticmq.conf."
