#!/usr/bin/env bash
# ============================================================
# aws/deploy.sh — Build, push to ECR, update ECS service
# Usage: bash aws/deploy.sh [tag]
#   tag defaults to git short SHA or "latest"
# ============================================================
set -euo pipefail

# Same pattern as policy-agent-ref: deploy with whatever account the AWS CLI is using
# Trim whitespace/newlines — a trailing \\n in ACCOUNT_ID breaks JSON for register-task-definition
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text | tr -d '\r\n')
REGION="us-east-1"
APP="ahead-onboarding"
CLUSTER="${APP}-cluster"
SERVICE="${APP}-service"
ECR="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com"

TAG="${1:-$(git rev-parse --short HEAD 2>/dev/null || echo latest)}"
TAG=$(printf '%s' "$TAG" | tr -d '\r\n')

echo "=========================================="
echo " AHEAD Onboarding — Deploy"
echo " Tag: $TAG | Account: $ACCOUNT_ID"
echo "=========================================="

# ── 0. ECR repositories (create if missing — same names as aws/setup.sh) ──
echo ""
echo "[1/7] Ensuring ECR repositories exist..."
for repo in "${APP}-frontend" "${APP}-backend" "${APP}-bot"; do
  if aws ecr describe-repositories --repository-names "$repo" --region "$REGION" &>/dev/null; then
    echo "  ✓ $repo"
  else
    echo "  Creating $repo..."
    aws ecr create-repository \
      --repository-name "$repo" \
      --region "$REGION" \
      --image-scanning-configuration scanOnPush=true \
      --output text
  fi
done

# ── 1. ECR login ─────────────────────────────────────────────
echo ""
echo "[2/7] Logging in to ECR..."
aws ecr get-login-password --region "$REGION" \
  | docker login --username AWS --password-stdin "$ECR"

# ── 2. Build images ──────────────────────────────────────────
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
echo ""
echo "[3/7] Building Docker images..."

docker build \
  -t "${ECR}/${APP}-backend:${TAG}" \
  -t "${ECR}/${APP}-backend:latest" \
  -f "${ROOT}/server/Dockerfile" \
  "${ROOT}/server"

docker build \
  -t "${ECR}/${APP}-frontend:${TAG}" \
  -t "${ECR}/${APP}-frontend:latest" \
  -f "${ROOT}/Dockerfile.frontend" \
  "${ROOT}"

docker build \
  -t "${ECR}/${APP}-bot:${TAG}" \
  -t "${ECR}/${APP}-bot:latest" \
  -f "${ROOT}/bot/Dockerfile" \
  "${ROOT}/bot"

echo "  ✓ Images built"

# ── 3. Push images ───────────────────────────────────────────
echo ""
echo "[4/7] Pushing to ECR..."

docker push "${ECR}/${APP}-backend:${TAG}"
docker push "${ECR}/${APP}-backend:latest"
docker push "${ECR}/${APP}-frontend:${TAG}"
docker push "${ECR}/${APP}-frontend:latest"
docker push "${ECR}/${APP}-bot:${TAG}"
docker push "${ECR}/${APP}-bot:latest"

echo "  ✓ Pushed to ECR"

# ── 3b. Execution role (ECS must assume this to pull images + read task secrets)
echo ""
echo "[4b/7] Ensuring ECS task execution role..."
bash "${ROOT}/aws/ensure-ecs-execution-role.sh"

# ── 4. Register task definition ──────────────────────────────
echo ""
echo "[5/7] Registering ECS task definition..."

# Match IAM/Secrets ARNs + image registry account to $ACCOUNT_ID.
# Only replace :latest on "image" lines — a global :latest replace can corrupt JSON (e.g. ARNs/strings).
TASK_DEF=$(
  sed "s|740315635748|${ACCOUNT_ID}|g" "${ROOT}/aws/task-definition.json" \
    | sed "/\"image\":/s|:latest|:${TAG}|g"
)

TASK_DEF_FILE=$(mktemp)
trap 'rm -f "$TASK_DEF_FILE"' EXIT
printf '%s' "$TASK_DEF" >"$TASK_DEF_FILE"
TASK_ARN=$(aws ecs register-task-definition \
  --region "$REGION" \
  --cli-input-json "file://${TASK_DEF_FILE}" \
  --query 'taskDefinition.taskDefinitionArn' \
  --output text)
trap - EXIT
rm -f "$TASK_DEF_FILE"

echo "  ✓ Task definition: $TASK_ARN"

# ── 5b. ECS cluster + logs (same as aws/setup.sh — idempotent) ─────────────
echo ""
echo "[6/7] Ensuring ECS cluster and log group exist..."

CLUSTER_STATUS=$(aws ecs describe-clusters --clusters "$CLUSTER" --region "$REGION" \
  --query 'clusters[0].status' --output text 2>/dev/null || echo "")
if [[ "$CLUSTER_STATUS" != "ACTIVE" ]]; then
  echo "  Creating cluster $CLUSTER..."
  aws ecs create-cluster \
    --cluster-name "$CLUSTER" \
    --region "$REGION" \
    --capacity-providers FARGATE FARGATE_SPOT \
    --output text
fi
echo "  ✓ Cluster: $CLUSTER"

aws logs create-log-group --log-group-name "/ecs/${APP}" --region "$REGION" 2>/dev/null || true
aws logs put-retention-policy \
  --log-group-name "/ecs/${APP}" \
  --retention-in-days 30 \
  --region "$REGION" 2>/dev/null || true

# ── 6. Update ECS service (service must exist — run create-service.sh once) ─
echo ""
echo "[7/7] Updating ECS service..."

MISSING=$(aws ecs describe-services --cluster "$CLUSTER" --services "$SERVICE" --region "$REGION" \
  --query 'failures[0].reason' --output text 2>/dev/null || echo "")
if [[ "$MISSING" == "MISSING" ]]; then
  SUBNETS_USE="${ECS_SUBNET_IDS:-}"
  SG_USE="${ECS_SECURITY_GROUP_ID:-}"

  # GitHub Actions: if no secrets, try default VPC (many dev accounts) — like Terraform owning networking for policy-agent
  if [[ -z "$SUBNETS_USE" || -z "$SG_USE" ]]; then
    if [[ "${GITHUB_ACTIONS:-}" == "true" ]] || [[ "${ECS_AUTO_DEFAULT_VPC:-}" == "1" ]]; then
      echo "  Service missing — auto-selecting default VPC (CI or ECS_AUTO_DEFAULT_VPC=1)..."
      DEF_VPC=$(aws ec2 describe-vpcs --filters Name=isDefault,Values=true \
        --query 'Vpcs[0].VpcId' --output text --region "$REGION" 2>/dev/null || true)
      if [[ -n "$DEF_VPC" && "$DEF_VPC" != "None" ]]; then
        RAW_SUB=$(aws ec2 describe-subnets --filters "Name=vpc-id,Values=$DEF_VPC" \
          --query 'Subnets[:2].SubnetId' --output text --region "$REGION")
        SUBNETS_USE=$(echo "$RAW_SUB" | tr '\t' ',' | tr ' ' ',')
        SG_USE=$(aws ec2 describe-security-groups \
          --filters "Name=vpc-id,Values=$DEF_VPC" "Name=group-name,Values=default" \
          --query 'SecurityGroups[0].GroupId' --output text --region "$REGION")
      fi
      NS=$(echo "$SUBNETS_USE" | awk -F, '{print NF}')
      if [[ "${NS:-0}" -lt 2 ]] || [[ -z "$SG_USE" || "$SG_USE" == "None" ]]; then
        echo ""
        echo "::error::No usable default VPC (or fewer than 2 subnets). This account needs explicit networking."
        echo "  Add GitHub secrets: ECS_SUBNET_IDS + ECS_SECURITY_GROUP_ID"
        echo "  Or run locally: bash aws/create-service.sh 'subnet-a,subnet-b' 'sg-xxx'"
        echo "  Docs: .github/DEPLOY_SETUP.md"
        exit 1
      fi
      echo "  Using default VPC $DEF_VPC — subnets=$SUBNETS_USE sg=$SG_USE"
    fi
  fi

  if [[ -n "$SUBNETS_USE" && -n "$SG_USE" ]]; then
    echo "  Creating ECS service..."
    bash "${ROOT}/aws/create-service.sh" "$SUBNETS_USE" "$SG_USE" "${ECS_TARGET_GROUP_ARN:-}"
  else
    echo ""
    echo "::error::ECS service '$SERVICE' does not exist yet. Choose one:"
    echo "  A) GitHub: add secrets ECS_SUBNET_IDS + ECS_SECURITY_GROUP_ID (see .github/DEPLOY_SETUP.md)"
    echo "  B) Local:  ECS_AUTO_DEFAULT_VPC=1 bash aws/deploy.sh   # if you have a default VPC"
    echo "            bash aws/suggest-create-service.sh"
    echo "            bash aws/create-service.sh 'subnet-a,subnet-b' 'sg-xxx'"
    echo "  C)        bash aws/setup.sh   # then (B)"
    echo "  Docs: .github/DEPLOY_SETUP.md"
    exit 1
  fi
fi

aws ecs update-service \
  --cluster "$CLUSTER" \
  --service "$SERVICE" \
  --task-definition "$TASK_ARN" \
  --force-new-deployment \
  --region "$REGION" \
  --output table

echo ""
echo "=========================================="
echo " Deployment triggered!"
echo " Monitor: https://$REGION.console.aws.amazon.com/ecs/v2/clusters/$CLUSTER/services/$SERVICE"
echo "=========================================="

# Wait for service stability (optional; skip in CI / non-interactive)
echo ""
if [[ "${CI:-}" == "true" ]] || [[ "${GITHUB_ACTIONS:-}" == "true" ]] || [[ ! -t 0 ]]; then
  echo "Skipping interactive stabilize wait (CI or non-TTY). Use: aws ecs wait services-stable --cluster $CLUSTER --services $SERVICE --region $REGION"
else
  read -p "Wait for deployment to stabilize? [y/N] " WAIT
  if [[ "$WAIT" =~ ^[Yy]$ ]]; then
    echo "Waiting for service to reach steady state..."
    aws ecs wait services-stable \
      --cluster "$CLUSTER" \
      --services "$SERVICE" \
      --region "$REGION"
    echo "  ✓ Service is stable!"
  fi
fi
