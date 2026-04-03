# Resolve account from AWS CLI (same idea as policy-agent-ref deploy scripts)
ACCOUNT_ID  := $(shell aws sts get-caller-identity --query Account --output text 2>/dev/null || echo 740315635748)
REGION      := us-east-1
APP         := ahead-onboarding
ECR         := $(ACCOUNT_ID).dkr.ecr.$(REGION).amazonaws.com
TAG         ?= $(shell git rev-parse --short HEAD 2>/dev/null || echo latest)

.PHONY: help dev prod build push deploy setup logs status

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

# ── Local development ─────────────────────────────────────────
dev: ## Start local dev (hot-reload Vite + ts-node-dev)
	docker-compose up --build

prod-local: ## Test production build locally (nginx + compiled backend)
	docker-compose -f docker-compose.prod.yml up --build

stop: ## Stop all containers
	docker-compose down
	docker-compose -f docker-compose.prod.yml down 2>/dev/null || true

# ── Build & Push ──────────────────────────────────────────────
ecr-login: ## Authenticate Docker with ECR
	aws ecr get-login-password --region $(REGION) \
	  | docker login --username AWS --password-stdin $(ECR)

build: ## Build all Docker images (backend, frontend, bot)
	docker build \
	  -t $(ECR)/$(APP)-backend:$(TAG) \
	  -t $(ECR)/$(APP)-backend:latest \
	  -f server/Dockerfile server/
	docker build \
	  -t $(ECR)/$(APP)-frontend:$(TAG) \
	  -t $(ECR)/$(APP)-frontend:latest \
	  -f Dockerfile.frontend .
	docker build \
	  -t $(ECR)/$(APP)-bot:$(TAG) \
	  -t $(ECR)/$(APP)-bot:latest \
	  -f bot/Dockerfile bot/

push: ecr-login build ## Build and push images to ECR
	docker push $(ECR)/$(APP)-backend:$(TAG)
	docker push $(ECR)/$(APP)-backend:latest
	docker push $(ECR)/$(APP)-frontend:$(TAG)
	docker push $(ECR)/$(APP)-frontend:latest
	docker push $(ECR)/$(APP)-bot:$(TAG)
	docker push $(ECR)/$(APP)-bot:latest

# ── AWS Deployment ────────────────────────────────────────────
setup: ## One-time AWS infrastructure setup (ECR, IAM, ECS cluster, logs)
	bash aws/setup.sh

deploy: push ## Build, push, register task def, and update ECS service
	bash aws/deploy.sh $(TAG)

create-service: ## Create ECS service (first time only) — provide SUBNETS and SG
	@echo "Usage: make create-service SUBNETS=subnet-abc,subnet-def SG=sg-xyz"
	bash aws/create-service.sh $(SUBNETS) $(SG)

# ── Operations ────────────────────────────────────────────────
logs: ## Tail live ECS logs
	aws logs tail /ecs/$(APP) --follow --region $(REGION)

status: ## Show ECS service status
	aws ecs describe-services \
	  --cluster $(APP)-cluster \
	  --services $(APP)-service \
	  --region $(REGION) \
	  --query 'services[0].{Status:status,Running:runningCount,Desired:desiredCount,Pending:pendingCount}' \
	  --output table

admin: ## Grant admin role to a user (EMAIL=you@ahead.com)
	@echo "Granting admin to $(EMAIL)..."
	cd server && npx ts-node -e "\
	  require('./src/aws'); \
	  const { updateUserRole } = require('./src/db'); \
	  updateUserRole('$(EMAIL)', 'admin').then(() => { console.log('Done!'); process.exit(0); });"
