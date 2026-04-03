#!/usr/bin/env bash
# ============================================================
# aws/create-service.sh — Create the ECS service (first time only)
# Usage: bash aws/create-service.sh <subnet-ids> <security-group-id> [alb-target-group-arn]
#
# Example:
#   bash aws/create-service.sh subnet-abc123,subnet-def456 sg-xyz789
#
# To find your VPC resources:
#   aws ec2 describe-subnets --region us-east-1 --output table
#   aws ec2 describe-security-groups --region us-east-1 --output table
# ============================================================
set -euo pipefail

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text | tr -d '\r\n')
REGION="us-east-1"
APP="ahead-onboarding"
CLUSTER="${APP}-cluster"
SERVICE="${APP}-service"

SUBNETS="${1:?Usage: $0 <subnet-ids> <security-group-id> [target-group-arn]}"
SECURITY_GROUP="${2:?Usage: $0 <subnet-ids> <security-group-id> [target-group-arn]}"
TARGET_GROUP_ARN="${3:-}"

# Get latest task definition
TASK_ARN=$(aws ecs list-task-definitions \
  --family-prefix "$APP" \
  --region "$REGION" \
  --sort DESC \
  --query 'taskDefinitionArns[0]' \
  --output text)

echo "Creating ECS service: $SERVICE"
echo "  Cluster: $CLUSTER"
echo "  Task:    $TASK_ARN"
echo "  Subnets: $SUBNETS"
echo "  SG:      $SECURITY_GROUP"

# Build load-balancer config if target group provided
LB_CONFIG=""
if [[ -n "$TARGET_GROUP_ARN" ]]; then
  LB_CONFIG="--load-balancers targetGroupArn=${TARGET_GROUP_ARN},containerName=frontend,containerPort=80"
fi

aws ecs create-service \
  --cluster "$CLUSTER" \
  --service-name "$SERVICE" \
  --task-definition "$TASK_ARN" \
  --desired-count 1 \
  --launch-type FARGATE \
  --platform-version LATEST \
  --network-configuration "awsvpcConfiguration={subnets=[${SUBNETS}],securityGroups=[${SECURITY_GROUP}],assignPublicIp=ENABLED}" \
  $LB_CONFIG \
  --health-check-grace-period-seconds 60 \
  --deployment-configuration "minimumHealthyPercent=50,maximumPercent=200" \
  --region "$REGION" \
  --output table

echo ""
echo "✓ Service created: $SERVICE"
echo ""
echo "View in console:"
echo "  https://${REGION}.console.aws.amazon.com/ecs/v2/clusters/${CLUSTER}/services/${SERVICE}"
