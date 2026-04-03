#!/usr/bin/env bash
# Prints a ready-to-run create-service.sh command using the default VPC (if any).
# Review security groups / subnets before production — corporate accounts often have no default VPC.
set -euo pipefail

REGION="${AWS_REGION:-us-east-1}"
APP="ahead-onboarding"

VPC=$(aws ec2 describe-vpcs --filters Name=isDefault,Values=true \
  --query 'Vpcs[0].VpcId' --output text --region "$REGION" 2>/dev/null || echo "none")

if [[ -z "$VPC" || "$VPC" == "none" ]]; then
  echo "No default VPC in $REGION. Pick subnets + a security group manually:"
  echo "  aws ec2 describe-subnets --region $REGION --output table"
  echo "  aws ec2 describe-security-groups --region $REGION --output table"
  echo "Then:"
  echo "  bash aws/create-service.sh 'subnet-A,subnet-B' 'sg-xxx'"
  exit 1
fi

# First two subnets in default VPC
RAW=$(aws ec2 describe-subnets --filters "Name=vpc-id,Values=$VPC" \
  --query 'Subnets[:2].SubnetId' --output text --region "$REGION")
SUBNETS=$(echo "$RAW" | tr '\t' ',' | tr ' ' ',')
COUNT=$(echo "$SUBNETS" | awk -F, '{print NF}')
if [[ "${COUNT:-0}" -lt 2 ]]; then
  echo "Default VPC $VPC needs at least 2 subnets. Found: $SUBNETS"
  exit 1
fi

SG=$(aws ec2 describe-security-groups \
  --filters "Name=vpc-id,Values=$VPC" "Name=group-name,Values=default" \
  --query 'SecurityGroups[0].GroupId' --output text --region "$REGION")

if [[ -z "$SG" || "$SG" == "None" ]]; then
  echo "Could not find default security group in $VPC"
  exit 1
fi

echo "# Default VPC $VPC — open ports on $SG as needed (80, 3978, 3001)."
echo "bash \"$(dirname "$0")/create-service.sh\" '$SUBNETS' '$SG'"
