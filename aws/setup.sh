#!/usr/bin/env bash
# ============================================================
# aws/setup.sh — ONE-TIME AWS infrastructure setup
# Run this once before your first deployment.
# Prerequisites: AWS CLI configured (same access keys / profile as policy-agent-ref is fine), region us-east-1
# ============================================================
set -euo pipefail

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGION="us-east-1"
APP="ahead-onboarding"

echo "=========================================="
echo " AHEAD Onboarding — AWS Setup"
echo " Account: $ACCOUNT_ID | Region: $REGION"
echo "=========================================="

# ── 1. ECR Repositories ──────────────────────────────────────
echo ""
echo "[1/6] Creating ECR repositories..."

for repo in "${APP}-frontend" "${APP}-backend" "${APP}-bot"; do
  aws ecr describe-repositories --repository-names "$repo" --region "$REGION" > /dev/null 2>&1 \
    || aws ecr create-repository \
        --repository-name "$repo" \
        --region "$REGION" \
        --image-scanning-configuration scanOnPush=true \
        --output table || true
  echo "  ✓ ECR: $repo"
done

# ── 2. IAM Task Role ─────────────────────────────────────────
echo ""
echo "[2/6] Creating ECS task IAM role..."

TRUST_POLICY='{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Service": "ecs-tasks.amazonaws.com" },
    "Action": "sts:AssumeRole"
  }]
}'

ROLE_NAME="${APP}-task-role"
aws iam get-role --role-name "$ROLE_NAME" > /dev/null 2>&1 \
  || aws iam create-role \
      --role-name "$ROLE_NAME" \
      --assume-role-policy-document "$TRUST_POLICY" \
      --description "ECS task role for AHEAD Onboarding App"

aws iam put-role-policy \
  --role-name "$ROLE_NAME" \
  --policy-name "${APP}-permissions" \
  --policy-document file://$(dirname "$0")/iam-policy.json

echo "  ✓ IAM role: $ROLE_NAME"

# ── 3. ECS Cluster ───────────────────────────────────────────
echo ""
echo "[3/6] Creating ECS Fargate cluster..."

CLUSTER_NAME="${APP}-cluster"
aws ecs describe-clusters --clusters "$CLUSTER_NAME" --region "$REGION" \
  | grep -q '"status": "ACTIVE"' \
  || aws ecs create-cluster \
      --cluster-name "$CLUSTER_NAME" \
      --region "$REGION" \
      --capacity-providers FARGATE FARGATE_SPOT \
      --output table

echo "  ✓ ECS cluster: $CLUSTER_NAME"

# ── 4. CloudWatch Log Group ──────────────────────────────────
echo ""
echo "[4/6] Creating CloudWatch log group..."

aws logs create-log-group \
  --log-group-name "/ecs/${APP}" \
  --region "$REGION" 2>/dev/null || true

aws logs put-retention-policy \
  --log-group-name "/ecs/${APP}" \
  --retention-in-days 30 \
  --region "$REGION"

echo "  ✓ Log group: /ecs/${APP} (30 day retention)"

# ── 5. JWT Secret in Secrets Manager ────────────────────────
echo ""
echo "[5/6] Creating JWT secret in Secrets Manager..."

JWT_SECRET=$(openssl rand -base64 48)
aws secretsmanager describe-secret \
  --secret-id "ahead-onboarding-jwt-secret" \
  --region "$REGION" > /dev/null 2>&1 \
|| aws secretsmanager create-secret \
    --name "ahead-onboarding-jwt-secret" \
    --secret-string "$JWT_SECRET" \
    --region "$REGION" \
    --description "JWT signing secret for AHEAD Onboarding App"

echo "  ✓ JWT secret created (arn:aws:secretsmanager:$REGION:$ACCOUNT_ID:secret:ahead-onboarding-jwt-secret)"

# ── 6. Bot secret in Secrets Manager ────────────────────────
echo ""
echo "[6/7] Creating bot shared secret in Secrets Manager..."

BOT_SECRET=$(openssl rand -base64 32)
aws secretsmanager describe-secret \
  --secret-id "ahead-onboarding-bot-secret" \
  --region "$REGION" > /dev/null 2>&1 \
|| aws secretsmanager create-secret \
    --name "ahead-onboarding-bot-secret" \
    --secret-string "$BOT_SECRET" \
    --region "$REGION" \
    --description "Shared secret between bot and backend for AHEAD Onboarding App"

echo "  ✓ Bot secret created"
echo ""
echo "  ⚠  After registering in Azure, store Microsoft credentials:"
echo "     aws secretsmanager create-secret --name ahead-onboarding-microsoft-app-id --secret-string '<APP_ID>' --region $REGION"
echo "     aws secretsmanager create-secret --name ahead-onboarding-microsoft-app-password --secret-string '<APP_PASSWORD>' --region $REGION"

# ── 7. Print next steps ──────────────────────────────────────
echo ""
echo "=========================================="
echo " Setup complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo ""
echo "  1. Register bot in Azure Portal (portal.azure.com):"
echo "     a. App Registrations → New → copy App ID + create secret"
echo "     b. Azure Bot → Create (F0 free tier)"
echo "     c. Store credentials (see [6/7] output above)"
echo ""
echo "  2. Create a VPC + subnets if you don't have one:"
echo "     aws ec2 describe-vpcs --region $REGION"
echo ""
echo "  3. Create an Application Load Balancer (ALB) pointing to port 80"
echo "     of the ECS service (or use AWS App Runner for simpler setup)."
echo ""
echo "  4. Run the deploy script to build and push images:"
echo "     make deploy"
echo ""
echo "  5. Create the ECS service (first time only):"
echo "     bash aws/create-service.sh <subnet-id> <security-group-id>"
echo ""
