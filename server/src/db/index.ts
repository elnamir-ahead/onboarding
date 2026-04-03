import {
  CreateTableCommand,
  DescribeTableCommand,
  DynamoDBClient,
  waitUntilTableExists,
} from '@aws-sdk/client-dynamodb';
import {
  GetCommand,
  PutCommand,
  DeleteCommand,
  QueryCommand,
  ScanCommand,
  UpdateCommand,
  BatchWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import { dynamo, TABLES } from '../aws';

// ── Table bootstrap ──────────────────────────────────────────────────────────
const rawClient = new DynamoDBClient({ region: process.env.AWS_REGION ?? 'us-east-1' });

async function tableExists(name: string): Promise<boolean> {
  try {
    await rawClient.send(new DescribeTableCommand({ TableName: name }));
    return true;
  } catch {
    return false;
  }
}

async function createTable(params: ConstructorParameters<typeof CreateTableCommand>[0]) {
  try {
    await rawClient.send(new CreateTableCommand(params));
    console.log(`[DB] Created table: ${params.TableName}, waiting for ACTIVE...`);
    await waitUntilTableExists(
      { client: rawClient, maxWaitTime: 60 },
      { TableName: params.TableName! }
    );
    console.log(`[DB] Table ${params.TableName} is ACTIVE.`);
  } catch (err) {
    console.error(`[DB] Failed to create table ${params.TableName}:`, err);
    throw err;
  }
}

export async function bootstrapTables() {
  // Users table — PK: email
  if (!(await tableExists(TABLES.USERS))) {
    await createTable({
      TableName: TABLES.USERS,
      KeySchema: [{ AttributeName: 'email', KeyType: 'HASH' }],
      AttributeDefinitions: [{ AttributeName: 'email', AttributeType: 'S' }],
      BillingMode: 'PAY_PER_REQUEST',
    });
  }

  // Tasks table — PK: id
  if (!(await tableExists(TABLES.TASKS))) {
    await createTable({
      TableName: TABLES.TASKS,
      KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
      AttributeDefinitions: [{ AttributeName: 'id', AttributeType: 'S' }],
      BillingMode: 'PAY_PER_REQUEST',
    });
    await seedTasks();
  } else {
    // Table exists but may be empty if a previous seed failed
    const existing = await getAllTasks(true);
    if (existing.length === 0) {
      console.log('[DB] Tasks table is empty — re-seeding...');
      await seedTasks();
    }
  }

  // Progress table — PK: userId, SK: taskId
  if (!(await tableExists(TABLES.PROGRESS))) {
    await createTable({
      TableName: TABLES.PROGRESS,
      KeySchema: [
        { AttributeName: 'userId', KeyType: 'HASH' },
        { AttributeName: 'taskId', KeyType: 'RANGE' },
      ],
      AttributeDefinitions: [
        { AttributeName: 'userId', AttributeType: 'S' },
        { AttributeName: 'taskId', AttributeType: 'S' },
      ],
      BillingMode: 'PAY_PER_REQUEST',
    });
  }

  // Bot sessions table — PK: teamsId
  if (!(await tableExists(TABLES.BOT_SESSIONS))) {
    await createTable({
      TableName: TABLES.BOT_SESSIONS,
      KeySchema: [{ AttributeName: 'teamsId', KeyType: 'HASH' }],
      AttributeDefinitions: [{ AttributeName: 'teamsId', AttributeType: 'S' }],
      BillingMode: 'PAY_PER_REQUEST',
    });
  }

  console.log('[DB] All tables ready.');
}

// ── Seed tasks ───────────────────────────────────────────────────────────────
const DEFAULT_TASKS = [
  { id:'i9-section1', title:'Complete Section 1 of the I-9 Form', description:'Complete Section 1 of the I-9 form by Monday. Questions? Contact onboarding@ahead.com.', priority:'urgent', due_label:'Due Monday', category:'HR & Compliance', link_label:'I-9 Instructions', link_url:'https://archie.ahead.com', sort_order:1, active:true },
  { id:'i9-documents', title:'Meet with I-9 Representative', description:'Present your I-9 documents to an I-9 representative by Wednesday.', priority:'urgent', due_label:'Due Wednesday', category:'HR & Compliance', link_label:'I-9 Instructions', link_url:'https://archie.ahead.com', sort_order:2, active:true },
  { id:'headshot', title:'Upload Headshot to UKGPro', description:'Business casual photo, no distracting backgrounds. Submit HR Help ticket to upload.', priority:'urgent', due_label:'Due Friday', category:'HR & Compliance', link_label:'UKGPro HR Help', link_url:'https://n11.ultipro.com', sort_order:3, active:true },
  { id:'compliance-training', title:'Complete Mandatory Compliance Training', description:'Complete AHEAD Compliance Training in KnowBe4 (access via Okta).', priority:'urgent', due_label:'Week 1', category:'HR & Compliance', link_label:'KnowBe4 via Okta', link_url:'https://ahead.okta.com', sort_order:4, active:true },
  { id:'pto-submission', title:'Submit Known PTO in UKG', description:'Submit any known PTO for the month/quarter in UKG.', priority:'urgent', due_label:'Week 1', category:'HR & Compliance', link_label:'Employee Time Off Guide', link_url:'https://archie.ahead.com', sort_order:5, active:true },
  { id:'new-hire-page', title:'Review New Hire Page on Archie', description:'Go to ARCHIE > Employee Resources and review the New Hire page.', priority:'week1', due_label:'Week 1', category:'Getting Started', link_label:'ARCHIE', link_url:'https://archie.ahead.com', sort_order:6, active:true },
  { id:'ukg-acknowledge', title:'Acknowledge Key Documents in UKG', description:'Log into UKG > Home (via Okta) and acknowledge all key documents.', priority:'week1', due_label:'Week 1', category:'HR & Compliance', link_label:'UKG via Okta', link_url:'https://ahead.okta.com', sort_order:7, active:true },
  { id:'new-hire-gifts', title:'Order New Hire Gifts', description:'Fill out the New Hire Gift Order Form to receive your welcome gifts.', priority:'week1', due_label:'Week 1', category:'Getting Started', link_label:'New Hire Gift Order Form', link_url:'https://archie.ahead.com', sort_order:8, active:true },
  { id:'email-signature', title:'Set Up Email Signature', description:'Configure your professional email signature following AHEAD brand guidelines.', priority:'week1', due_label:'Week 1', category:'Tools & Setup', link_label:'Email Signature Guidelines', link_url:'https://archie.ahead.com', sort_order:9, active:true },
  { id:'teams-channels', title:'Join Microsoft Teams Channels', description:'Join Teams channels pertinent to your role. Discuss with your manager. Adjust notifications!', priority:'week1', due_label:'Week 1', category:'Tools & Setup', sort_order:10, active:true },
  { id:'teams-mobile', title:'Set Up Microsoft Teams on Mobile', description:'Download and set up Microsoft Teams on your mobile device.', priority:'week1', due_label:'Week 1', category:'Tools & Setup', sort_order:11, active:true },
  { id:'linkedin', title:'Update LinkedIn Profile', description:'Update your LinkedIn profile with your new role at AHEAD. Download banners from ARCHIE.', priority:'week1', due_label:'Week 1', category:'Tools & Setup', link_label:'LinkedIn Banners on ARCHIE', link_url:'https://archie.ahead.com', sort_order:12, active:true },
  { id:'overtime-check', title:'Check Overtime Eligibility', description:'Check your offer letter for non-exempt status. If applicable, track time in UKG.', priority:'week1', due_label:'Week 1', category:'HR & Compliance', link_label:'Time Tracking Guide', link_url:'https://archie.ahead.com', sort_order:13, active:true },
  { id:'office-keycard', title:'Request Office Keycard (if applicable)', description:'Email officeaccess@ahead.com with: legal name, headshot (150kb+), office locations, mailing address.', priority:'week1', due_label:'Week 1', category:'Getting Started', link_label:'officeaccess@ahead.com', link_url:'mailto:officeaccess@ahead.com', sort_order:14, active:true },
  { id:'github-account', title:'Create GitHub Account with AHEAD Email', description:'Create a GitHub account with your AHEAD email, then request Enterprise access via IT ticket.', priority:'week1', due_label:'Week 1', category:'AI Practice Setup', link_label:'Request App Access', link_url:'https://aheadit.service-now.com', sort_order:15, active:true },
  { id:'github-repos', title:'Get Added to AHEAD GitHub Repos', description:'Get added to AHEAD Labs (agentic-modernization). Contact Dan Wittenburg for Data Science repos.', priority:'week1', due_label:'Week 1', category:'AI Practice Setup', link_label:'AHEAD Labs GitHub', link_url:'https://github.com/AHEAD-Labs/agentic-modernization', sort_order:16, active:true },
  { id:'software-tools', title:'Request AI Practice Software Access', description:'Request access to: Lucid, Glean, Smartsheet, Microsoft Copilot, Windsurf, and other needed tools.', priority:'week1', due_label:'Week 1', category:'AI Practice Setup', link_label:'Request App Access - IT', link_url:'https://aheadit.service-now.com', sort_order:17, active:true },
  { id:'read-ai-docs', title:'Read AI Practice Documents', description:'Review IMPACT 2027, Executive Overview, Hatch Sales Plays, Foundry, Enablement Hub, and The Book on AHEAD for Clients.', priority:'week1', due_label:'Week 1', category:'AI Practice Setup', link_label:'IMPACT 2027', link_url:'https://archie.ahead.com/sites/impact/sitepagemodern/22125/impact-2027-v2', sort_order:18, active:true },
  { id:'benefits', title:'Enroll in Benefits Plan', description:'Enroll in your benefits plan. See ARCHIE > How to Enroll In Benefits.', priority:'month1', due_label:'Month 1', category:'HR & Compliance', link_label:'Benefits Enrollment Guide', link_url:'https://archie.ahead.com', sort_order:19, active:true },
  { id:'performance-goals', title:'Set Annual Performance Goals', description:'Align with your Manager on Annual Performance and Development Goals in the Learning and Performance Hub.', priority:'month1', due_label:'Month 1', category:'HR & Compliance', link_label:'Perform to IMPACT', link_url:'https://archie.ahead.com', sort_order:20, active:true },
  { id:'concur-setup', title:'Set Up Concur Profile', description:'Set up your Concur profile for expense reporting and install Concur mobile.', priority:'month1', due_label:'Month 1', category:'Tools & Setup', link_label:'Concur Expense Guide', link_url:'https://archie.ahead.com', sort_order:21, active:true },
  { id:'certifai', title:'Submit Industry Certifications to CertifAI', description:'Review the ARCHIE CertifAI page and enter your industry certifications.', priority:'month1', due_label:'Month 1', category:'Getting Started', link_label:'ARCHIE > CertifAI', link_url:'https://archie.ahead.com', sort_order:22, active:true },
  { id:'business-cards', title:'Order Business Cards (if applicable)', description:'Order new AHEAD business cards if applicable to your role via ARCHIE.', priority:'month1', due_label:'Month 1', category:'Getting Started', link_label:'ARCHIE > Business Cards', link_url:'https://archie.ahead.com', sort_order:23, active:true },
  { id:'meetings-brains', title:'Join Brains Assembly Meeting', description:'General AI talks. Contact Revo Tesha to be added.', priority:'month1', due_label:'Month 1', category:'AI Practice Setup', sort_order:24, active:true },
  { id:'meetings-hive', title:'Join Hive Friday Meetings', description:'Internal AI project updates. Contact Erin Hollingshad.', priority:'month1', due_label:'Month 1', category:'AI Practice Setup', sort_order:25, active:true },
  { id:'meetings-techontap', title:'Join Tech on Tap Meeting', description:'General tech and AI talks. Contact Rushda Umrani.', priority:'month1', due_label:'Month 1', category:'AI Practice Setup', sort_order:26, active:true },
];

async function seedTasks() {
  console.log('[DB] Seeding tasks...');
  // DynamoDB batch write allows max 25 items per batch
  const batches = [];
  for (let i = 0; i < DEFAULT_TASKS.length; i += 25) {
    batches.push(DEFAULT_TASKS.slice(i, i + 25));
  }
  for (const batch of batches) {
    await dynamo.send(new BatchWriteCommand({
      RequestItems: {
        [TABLES.TASKS]: batch.map(t => ({ PutRequest: { Item: t } })),
      },
    }));
  }
  console.log(`[DB] Seeded ${DEFAULT_TASKS.length} tasks.`);
}

// ── User operations ──────────────────────────────────────────────────────────
export interface DBUser {
  email: string;
  id: string;
  passwordHash: string;
  fullName: string;
  role: 'employee' | 'admin';
  createdAt: string;
}

export async function getUserByEmail(email: string): Promise<DBUser | null> {
  const result = await dynamo.send(new GetCommand({
    TableName: TABLES.USERS,
    Key: { email: email.toLowerCase() },
  }));
  return (result.Item as DBUser) ?? null;
}

export async function createUser(user: DBUser): Promise<void> {
  await dynamo.send(new PutCommand({ TableName: TABLES.USERS, Item: user }));
}

export async function updateUserRole(email: string, role: 'employee' | 'admin'): Promise<void> {
  await dynamo.send(new UpdateCommand({
    TableName: TABLES.USERS,
    Key: { email: email.toLowerCase() },
    UpdateExpression: 'SET #r = :r',
    ExpressionAttributeNames: { '#r': 'role' },
    ExpressionAttributeValues: { ':r': role },
  }));
}

export async function getAllUsers(): Promise<Omit<DBUser, 'passwordHash'>[]> {
  const result = await dynamo.send(new ScanCommand({
    TableName: TABLES.USERS,
    ProjectionExpression: 'email, id, fullName, #r, createdAt',
    ExpressionAttributeNames: { '#r': 'role' },
  }));
  return (result.Items ?? []) as Omit<DBUser, 'passwordHash'>[];
}

// ── Task operations ──────────────────────────────────────────────────────────
export interface DBTask {
  id: string;
  title: string;
  description: string;
  priority: string;
  due_label: string;
  category: string;
  link_label?: string;
  link_url?: string;
  sort_order: number;
  active: boolean;
}

export async function getAllTasks(includeInactive = false): Promise<DBTask[]> {
  const result = await dynamo.send(new ScanCommand({ TableName: TABLES.TASKS }));
  const tasks = (result.Items ?? []) as DBTask[];
  const filtered = includeInactive ? tasks : tasks.filter(t => t.active);
  return filtered.sort((a, b) => a.sort_order - b.sort_order);
}

export async function upsertTask(task: DBTask): Promise<void> {
  await dynamo.send(new PutCommand({ TableName: TABLES.TASKS, Item: task }));
}

export async function deleteTask(id: string): Promise<void> {
  await dynamo.send(new DeleteCommand({ TableName: TABLES.TASKS, Key: { id } }));
}

// ── Progress operations ──────────────────────────────────────────────────────
export async function getUserProgress(userId: string): Promise<string[]> {
  const result = await dynamo.send(new QueryCommand({
    TableName: TABLES.PROGRESS,
    KeyConditionExpression: 'userId = :uid',
    ExpressionAttributeValues: { ':uid': userId },
  }));
  return (result.Items ?? []).map((i) => (i as { taskId: string }).taskId);
}

export async function markTaskComplete(userId: string, taskId: string): Promise<void> {
  await dynamo.send(new PutCommand({
    TableName: TABLES.PROGRESS,
    Item: { userId, taskId, completedAt: new Date().toISOString() },
  }));
}

export async function markTaskIncomplete(userId: string, taskId: string): Promise<void> {
  await dynamo.send(new DeleteCommand({
    TableName: TABLES.PROGRESS,
    Key: { userId, taskId },
  }));
}

export async function resetUserProgress(userId: string): Promise<void> {
  const completed = await getUserProgress(userId);
  if (completed.length === 0) return;
  // DynamoDB batch delete
  const batches = [];
  for (let i = 0; i < completed.length; i += 25) {
    batches.push(completed.slice(i, i + 25));
  }
  for (const batch of batches) {
    await dynamo.send(new BatchWriteCommand({
      RequestItems: {
        [TABLES.PROGRESS]: batch.map(taskId => ({
          DeleteRequest: { Key: { userId, taskId } },
        })),
      },
    }));
  }
}

export async function getAllProgress(): Promise<{ userId: string; taskId: string }[]> {
  const result = await dynamo.send(new ScanCommand({
    TableName: TABLES.PROGRESS,
    ProjectionExpression: 'userId, taskId',
  }));
  return (result.Items ?? []) as { userId: string; taskId: string }[];
}

// ── Bot session operations ────────────────────────────────────────────────────
export interface BotSession {
  teamsId: string;
  email?: string;
  displayName?: string;
  history: { role: 'user' | 'assistant'; content: string }[];
  linkedAt?: string;
  updatedAt: string;
}

export async function getBotSession(teamsId: string): Promise<BotSession | null> {
  const result = await dynamo.send(new GetCommand({
    TableName: TABLES.BOT_SESSIONS,
    Key: { teamsId },
  }));
  return (result.Item as BotSession) ?? null;
}

export async function saveBotSession(session: BotSession): Promise<void> {
  await dynamo.send(new PutCommand({
    TableName: TABLES.BOT_SESSIONS,
    Item: session,
  }));
}
