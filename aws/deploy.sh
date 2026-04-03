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
echo "[1/6] Ensuring ECR repositories exist..."
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
echo "[2/6] Logging in to ECR..."
aws ecr get-login-password --region "$REGION" \
  | docker login --username AWS --password-stdin "$ECR"

# ── 2. Build images ──────────────────────────────────────────
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
echo ""
echo "[3/6] Building Docker images..."

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
echo "[4/6] Pushing to ECR..."

docker push "${ECR}/${APP}-backend:${TAG}"
docker push "${ECR}/${APP}-backend:latest"
docker push "${ECR}/${APP}-frontend:${TAG}"
docker push "${ECR}/${APP}-frontend:latest"
docker push "${ECR}/${APP}-bot:${TAG}"
docker push "${ECR}/${APP}-bot:latest"

echo "  ✓ Pushed to ECR"

# ── 4. Register task definition ──────────────────────────────
echo ""
echo "[5/6] Registering ECS task definition..."

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

# ── 5. Update ECS service ────────────────────────────────────
echo ""
echo "[6/6] Updating ECS service..."

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
