# GitHub Actions — Deploy AHEAD Onboarding (AWS ECS)

This workflow mirrors **policy-agent-ref**: use the **same** repository secrets you already use there.

## Required GitHub secrets

In the **onboarding** GitHub repo: **Settings → Secrets and variables → Actions**

| Secret | Same as policy-agent-ref? |
|--------|---------------------------|
| `AWS_ACCESS_KEY_ID` | Yes — can reuse the same IAM user key |
| `AWS_SECRET_ACCESS_KEY` | Yes |

Region is fixed to **`us-east-1`** in the workflow (same default as policy-agent-ref).

### Optional: first-time ECS service from GitHub Actions

If the ECS service **`ahead-onboarding-service`** does not exist yet, the deploy script exits unless you either run **`create-service.sh` locally** once, **or** add these secrets so CI can create the service automatically:

| Secret | Example value | Notes |
|--------|----------------|--------|
| `ECS_SUBNET_IDS` | `subnet-0abc,subnet-0def` | At least one subnet; **two** in different AZs is better. **No spaces.** Same VPC as the security group. |
| `ECS_SECURITY_GROUP_ID` | `sg-0123456789abcdef0` | Must allow **inbound** to **80** (frontend), **3978** (bot webhook), **3001** (API) from your ALB or the internet, as you intend. |
| `ECS_TARGET_GROUP_ARN` | *(optional)* | ALB target group ARN — attaches **frontend** container port **80** to the load balancer. |

Find subnets/SGs: `aws ec2 describe-subnets --region us-east-1` and `describe-security-groups`.

After the service exists once, you can remove `ECS_SUBNET_IDS` / `ECS_SECURITY_GROUP_ID` from secrets if you prefer (deploy will only **update** the service).

## IAM permissions (on top of policy-agent)

The policy-agent user has Lambda / S3 / CloudFront / DynamoDB / Bedrock. For **onboarding ECS deploy**, the same user also needs (or use a dedicated user with this policy attached):

- **ECR**: `CreateRepository` (deploy script creates `ahead-onboarding-backend`, `ahead-onboarding-frontend`, `ahead-onboarding-bot` if missing), `GetAuthorizationToken`, and on those repos: push/pull image APIs (`PutImage`, `BatchCheckLayerAvailability`, etc.)
- **ECS**: `RegisterTaskDefinition`, `UpdateService`, `DescribeServices`, `DescribeTaskDefinition`, `DescribeClusters`
- **IAM**: `PassRole` on `ecsTaskExecutionRole` and `ahead-onboarding-task-role` (scoped ARNs recommended)
- **Secrets Manager**: `GetSecretValue` for secrets referenced in the task definition (execution role usually covers pull; task role for app)
- **Logs**: `CreateLogStream`, `PutLogEvents` (often via task execution role — ensure it exists)

**One-time AWS setup** (from your machine, with the same credentials):

```bash
cd path/to/onboarding
bash aws/setup.sh
bash aws/create-service.sh <subnet-ids-comma-separated> <security-group-id>
```

- **`deploy.sh` creates** the **ECR** repos and **ECS cluster** if they are missing.
- It **does not** create the **ECS service** (needs your **VPC subnets** + **security group**). Until `ahead-onboarding-service` exists, step `[7/7]` fails with instructions — run **`create-service.sh`** once as above.

Then set **Secrets Manager** values for the bot (`ahead-onboarding-microsoft-app-id`, `ahead-onboarding-microsoft-app-password`, etc.) as described in `aws/setup.sh`.

## Manual deploy (local)

```bash
aws configure   # or export AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY like policy-agent-ref
cd onboarding
bash aws/deploy.sh
```

`aws/deploy.sh` uses **`aws sts get-caller-identity`** for the account ID (same pattern as `policy-agent-ref/scripts/deploy.sh`).

## Azure (Teams) is still required

ECS hosts the **containers**; **Azure Bot** + App Registration remain the identity for Microsoft Teams. Point the bot **messaging endpoint** at your public URL that reaches the **bot** container (e.g. ALB → `3978`).
