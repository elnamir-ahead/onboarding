#!/usr/bin/env bash
# Creates the ECS task execution role if missing (ECR pull, CloudWatch Logs, Secrets Manager
# for container secrets). Fargate needs this; generic ecsTaskExecutionRole may not exist.
set -euo pipefail

APP="ahead-onboarding"
EXEC_ROLE_NAME="${APP}-execution-role"
TRUST='{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Service": "ecs-tasks.amazonaws.com" },
    "Action": "sts:AssumeRole"
  }]
}'
MANAGED_POLICY="arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"

if ! aws iam get-role --role-name "$EXEC_ROLE_NAME" &>/dev/null; then
  echo "  Creating IAM role $EXEC_ROLE_NAME (ECS task execution)..."
  aws iam create-role \
    --role-name "$EXEC_ROLE_NAME" \
    --assume-role-policy-document "$TRUST" \
    --description "ECS execution role for $APP - ECR, logs, task secrets"
fi

aws iam attach-role-policy \
  --role-name "$EXEC_ROLE_NAME" \
  --policy-arn "$MANAGED_POLICY" || true

# Allow ECS agent to fetch task secrets from Secrets Manager.
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text | tr -d '\r\n')
REGION="us-east-1"
aws iam put-role-policy \
  --role-name "$EXEC_ROLE_NAME" \
  --policy-name "${APP}-execution-secrets-read" \
  --policy-document "{
    \"Version\": \"2012-10-17\",
    \"Statement\": [{
      \"Effect\": \"Allow\",
      \"Action\": [\"secretsmanager:GetSecretValue\", \"secretsmanager:DescribeSecret\"],
      \"Resource\": [
        \"arn:aws:secretsmanager:${REGION}:${ACCOUNT_ID}:secret:ahead-onboarding-*\",
        \"arn:aws:secretsmanager:${REGION}:${ACCOUNT_ID}:secret:openai_api_key*\"
      ]
    }]
  }" >/dev/null

echo "  ✓ Execution role: $EXEC_ROLE_NAME"
