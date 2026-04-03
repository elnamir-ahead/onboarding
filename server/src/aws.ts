import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

const REGION = process.env.AWS_REGION ?? 'us-east-1';

// DynamoDB
const rawDynamo = new DynamoDBClient({ region: REGION });
export const dynamo = DynamoDBDocumentClient.from(rawDynamo, {
  marshallOptions: { removeUndefinedValues: true },
});

// Secrets Manager
export const secretsClient = new SecretsManagerClient({ region: REGION });

// Cached OpenAI key
let _openAiKey: string | null = null;

export async function getOpenAiKey(): Promise<string> {
  if (_openAiKey) return _openAiKey;

  const arn = process.env.OPENAI_SECRET_ARN;
  if (!arn) throw new Error('OPENAI_SECRET_ARN environment variable is not set.');

  const cmd = new GetSecretValueCommand({ SecretId: arn });
  const result = await secretsClient.send(cmd);

  // Secret may be a plain string or a JSON object { openai_api_key: "sk-..." }
  let secret = result.SecretString ?? '';
  try {
    const parsed = JSON.parse(secret) as Record<string, string>;
    // Accept common key names
    secret =
      parsed.openai_api_key ??
      parsed.OPENAI_API_KEY ??
      parsed.api_key ??
      Object.values(parsed)[0] ??
      secret;
  } catch {
    // plain string — use as-is
  }

  if (!secret) throw new Error('OpenAI API key is empty in Secrets Manager.');
  _openAiKey = secret;
  return _openAiKey;
}

// DynamoDB table names
export const TABLES = {
  USERS: 'ahead-onboarding-users',
  TASKS: 'ahead-onboarding-tasks',
  PROGRESS: 'ahead-onboarding-progress',
  BOT_SESSIONS: 'ahead-onboarding-bot-sessions',
} as const;
