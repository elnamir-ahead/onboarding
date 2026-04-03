export type TaskPriority = 'urgent' | 'week1' | 'month1';

export interface OnboardingTask {
  id: string;
  title: string;
  description: string;
  priority: TaskPriority;
  dueLabel: string;
  link?: { label: string; url: string };
  category: string;
}

export const ONBOARDING_TASKS: OnboardingTask[] = [
  // Urgent / First Days
  {
    id: 'i9-section1',
    title: 'Complete Section 1 of the I-9 Form',
    description: 'Complete Section 1 of the I-9 form by Monday. Questions? Contact onboarding@ahead.com.',
    priority: 'urgent',
    dueLabel: 'Due Monday',
    link: { label: 'I-9 Instructions', url: 'https://archie.ahead.com' },
    category: 'HR & Compliance',
  },
  {
    id: 'i9-documents',
    title: 'Meet with I-9 Representative',
    description: 'Present your I-9 documents to an I-9 representative by Wednesday.',
    priority: 'urgent',
    dueLabel: 'Due Wednesday',
    link: { label: 'I-9 Instructions', url: 'https://archie.ahead.com' },
    category: 'HR & Compliance',
  },
  {
    id: 'headshot',
    title: 'Upload Headshot to UKGPro',
    description: 'Business casual photo, no distracting backgrounds, no objects obstructing face. Submit an HR Help ticket to upload.',
    priority: 'urgent',
    dueLabel: 'Due Friday',
    link: { label: 'UKGPro HR Help', url: 'https://n11.ultipro.com' },
    category: 'HR & Compliance',
  },
  {
    id: 'compliance-training',
    title: 'Complete Mandatory Compliance Training',
    description: 'Complete your mandatory AHEAD Compliance Training in KnowBe4 (access via Okta).',
    priority: 'urgent',
    dueLabel: 'Week 1',
    link: { label: 'KnowBe4 via Okta', url: 'https://ahead.okta.com' },
    category: 'HR & Compliance',
  },
  {
    id: 'pto-submission',
    title: 'Submit Known PTO in UKG',
    description: 'Submit any known PTO for the month/quarter in UKG.',
    priority: 'urgent',
    dueLabel: 'Week 1',
    link: { label: 'Employee Time Off Guide', url: 'https://archie.ahead.com' },
    category: 'HR & Compliance',
  },
  // Week 1
  {
    id: 'new-hire-page',
    title: 'Review New Hire Page on Archie',
    description: 'Go to ARCHIE > Employee Resources and review the New Hire page.',
    priority: 'week1',
    dueLabel: 'Week 1',
    link: { label: 'ARCHIE', url: 'https://archie.ahead.com' },
    category: 'Getting Started',
  },
  {
    id: 'ukg-acknowledge',
    title: 'Acknowledge Key Documents in UKG',
    description: 'Log into UKG > Home (via Okta) and acknowledge all key documents.',
    priority: 'week1',
    dueLabel: 'Week 1',
    link: { label: 'UKG via Okta', url: 'https://ahead.okta.com' },
    category: 'HR & Compliance',
  },
  {
    id: 'new-hire-gifts',
    title: 'Order New Hire Gifts',
    description: 'Fill out the New Hire Gift Order Form to receive your welcome gifts.',
    priority: 'week1',
    dueLabel: 'Week 1',
    link: { label: 'New Hire Gift Order Form', url: 'https://archie.ahead.com' },
    category: 'Getting Started',
  },
  {
    id: 'email-signature',
    title: 'Set Up Email Signature',
    description: 'Configure your professional email signature following AHEAD brand guidelines.',
    priority: 'week1',
    dueLabel: 'Week 1',
    link: { label: 'Email Signature Guidelines', url: 'https://archie.ahead.com' },
    category: 'Tools & Setup',
  },
  {
    id: 'teams-channels',
    title: 'Join Microsoft Teams Channels',
    description: 'Join Teams channels pertinent to your role. Discuss with your manager. Adjust channel-level notifications!',
    priority: 'week1',
    dueLabel: 'Week 1',
    category: 'Tools & Setup',
  },
  {
    id: 'teams-mobile',
    title: 'Set Up Microsoft Teams on Mobile',
    description: 'Download and set up Microsoft Teams on your mobile device.',
    priority: 'week1',
    dueLabel: 'Week 1',
    category: 'Tools & Setup',
  },
  {
    id: 'linkedin',
    title: 'Update LinkedIn Profile',
    description: 'Update your LinkedIn profile with your new role at AHEAD. Download LinkedIn Profile Banners from ARCHIE.',
    priority: 'week1',
    dueLabel: 'Week 1',
    link: { label: 'LinkedIn Banners on ARCHIE', url: 'https://archie.ahead.com' },
    category: 'Tools & Setup',
  },
  {
    id: 'overtime-check',
    title: 'Check Overtime Eligibility',
    description: 'Check your offer letter to see if you are non-exempt and eligible for overtime. If so, review the Time Tracking Guide and start tracking in UKG.',
    priority: 'week1',
    dueLabel: 'Week 1',
    link: { label: 'Time Tracking Guide', url: 'https://archie.ahead.com' },
    category: 'HR & Compliance',
  },
  {
    id: 'office-keycard',
    title: 'Request Office Keycard (if applicable)',
    description: 'If using an AHEAD office, email officeaccess@ahead.com with: full legal name, headshot (150kb+), office locations, mailing address, and vehicle info if parking.',
    priority: 'week1',
    dueLabel: 'Week 1',
    link: { label: 'officeaccess@ahead.com', url: 'mailto:officeaccess@ahead.com' },
    category: 'Getting Started',
  },
  // AI Practice Specific
  {
    id: 'github-account',
    title: 'Create GitHub Account with AHEAD Email',
    description: 'Make a GitHub account using your AHEAD email, then request access to GitHub Enterprise via IT service ticket.',
    priority: 'week1',
    dueLabel: 'Week 1',
    link: { label: 'Request App Access', url: 'https://aheadit.service-now.com' },
    category: 'AI Practice Setup',
  },
  {
    id: 'github-repos',
    title: 'Get Added to AHEAD GitHub Repos',
    description: 'Get added to AHEAD Labs (agentic-modernization) and Data Science repos. Contact Dan Wittenburg for Data Science repos.',
    priority: 'week1',
    dueLabel: 'Week 1',
    link: { label: 'AHEAD Labs GitHub', url: 'https://github.com/AHEAD-Labs/agentic-modernization' },
    category: 'AI Practice Setup',
  },
  {
    id: 'software-tools',
    title: 'Request AI Practice Software Access',
    description: 'Request access to: Lucid, Glean, Smartsheet, Microsoft Copilot, Windsurf (limited licenses), and any other needed tools.',
    priority: 'week1',
    dueLabel: 'Week 1',
    link: { label: 'Request App Access - IT', url: 'https://aheadit.service-now.com' },
    category: 'AI Practice Setup',
  },
  {
    id: 'read-ai-docs',
    title: 'Read AI Practice Documents',
    description: 'Review IMPACT 2027, Executive Overview, Hatch Sales Plays, Foundry, Enablement Hub, and The Book on AHEAD for Clients.',
    priority: 'week1',
    dueLabel: 'Week 1',
    link: { label: 'IMPACT 2027', url: 'https://archie.ahead.com/sites/impact/sitepagemodern/22125/impact-2027-v2' },
    category: 'AI Practice Setup',
  },
  // Month 1
  {
    id: 'benefits',
    title: 'Enroll in Benefits Plan',
    description: 'Enroll in your benefits plan. See ARCHIE > How to Enroll In Benefits.',
    priority: 'month1',
    dueLabel: 'Month 1',
    link: { label: 'Benefits Enrollment Guide', url: 'https://archie.ahead.com' },
    category: 'HR & Compliance',
  },
  {
    id: 'performance-goals',
    title: 'Set Annual Performance Goals',
    description: 'Align with your Manager on Annual Performance and Development Goals in the Learning and Performance Hub.',
    priority: 'month1',
    dueLabel: 'Month 1',
    link: { label: 'Perform to IMPACT', url: 'https://archie.ahead.com' },
    category: 'HR & Compliance',
  },
  {
    id: 'concur-setup',
    title: 'Set Up Concur Profile',
    description: 'Set up your Concur profile for expense reporting and install Concur mobile.',
    priority: 'month1',
    dueLabel: 'Month 1',
    link: { label: 'Concur Expense Guide', url: 'https://archie.ahead.com' },
    category: 'Tools & Setup',
  },
  {
    id: 'certifai',
    title: 'Submit Industry Certifications to CertifAI',
    description: 'Review the ARCHIE CertifAI page and enter your industry certifications.',
    priority: 'month1',
    dueLabel: 'Month 1',
    link: { label: 'ARCHIE > CertifAI', url: 'https://archie.ahead.com' },
    category: 'Getting Started',
  },
  {
    id: 'business-cards',
    title: 'Order Business Cards (if applicable)',
    description: 'Order new AHEAD business cards if applicable to your role via ARCHIE.',
    priority: 'month1',
    dueLabel: 'Month 1',
    link: { label: 'ARCHIE > Business Cards', url: 'https://archie.ahead.com' },
    category: 'Getting Started',
  },
  {
    id: 'meetings-brains',
    title: 'Join Brains Assembly Meeting',
    description: 'General AI talks meeting. Contact Revo Tesha to be added.',
    priority: 'month1',
    dueLabel: 'Month 1',
    category: 'AI Practice Setup',
  },
  {
    id: 'meetings-hive',
    title: 'Join Hive Friday Meetings',
    description: 'Updates and demos for internal AI projects (Security, Agentic, Infra, Accelerated Development). Contact Erin Hollingshad.',
    priority: 'month1',
    dueLabel: 'Month 1',
    category: 'AI Practice Setup',
  },
  {
    id: 'meetings-techontap',
    title: 'Join Tech on Tap Meeting',
    description: 'General tech and AI talks. Contact Rushda Umrani to be added.',
    priority: 'month1',
    dueLabel: 'Month 1',
    category: 'AI Practice Setup',
  },
];

export const SYSTEM_PROMPT = `You are AHEAD's friendly and knowledgeable AI Onboarding Assistant. Your job is to help new employees — especially those on the AI Practice team — get onboarded quickly and confidently.

You have deep knowledge of all AHEAD onboarding requirements and resources. Here is a comprehensive summary:

## AHEAD General Onboarding (New Hire Checklist)

### First Week - Urgent Tasks
- **I-9 Form (Section 1)** – Complete by Monday. Contact onboarding@ahead.com with questions.
- **I-9 Documents** – Meet with I-9 representative to present documents by Wednesday.
- **Headshot** – Upload business casual headshot to UKGPro by Friday. Submit via: UKGPro > HR Help > General HR Help > Add/Update Profile Photo.
- **KnowBe4 Compliance Training** – Complete mandatory training. Access via Okta.
- **UKG Document Acknowledgment** – Log into UKG > Home via Okta.
- **PTO Submission** – Submit known PTO for the month/quarter in UKG.
- **New Hire Gifts** – Fill out the New Hire Gift Order Form.
- **Email Signature** – Set up following Email Signatures Guidelines on ARCHIE.
- **Microsoft Teams** – Join role-relevant channels (discuss with manager), set up on mobile.
- **LinkedIn** – Update your LinkedIn profile, download banners from ARCHIE.
- **Overtime Check** – Check offer letter for non-exempt status. If applicable, use Time Tracking Guide and track time in UKG.
- **Office Keycard** – Email officeaccess@ahead.com with: full legal name, headshot (150kb+), office locations, mailing address. Include vehicle info for parking.

### Month 1
- **Benefits Enrollment** – Enroll via ARCHIE > How to Enroll In Benefits.
- **Performance Goals** – Align with manager in Learning and Performance Hub (Perform to IMPACT).
- **Concur Setup** – Set up profile for expense reports, install Concur mobile.
- **CertifAI** – Submit industry certifications on ARCHIE > CertifAI.
- **Business Cards** – Order via ARCHIE > Ordering Business Cards (if applicable).
- **AmEx Card** – If applicable, activate and link to Concur. Contact Amanda Piron.

## AI Practice-Specific Onboarding

### Key Documents to Read
- **IMPACT 2027** – AHEAD's business strategy: https://archie.ahead.com/sites/impact/sitepagemodern/22125/impact-2027-v2
- **Hatch Sales Plays** – https://archie.ahead.com/sites/focus-sales-plays/SitePageModern/14213/hatch
- **Foundry** – https://archie.ahead.com/sites/focus-sales-plays/SitePageModern/11622/ahead-foundry-formerly-esg
- **Enablement Hub** – https://archie.ahead.com/sites/solutions-and-selling/SitePageModern/11437/home
- **Experience AHEAD** – https://archie.ahead.com/sites/mergers-acquisitions/SitePageModern/11158/m-a-experience-ahead
- **The Book on AHEAD for Clients** – Available via SharePoint (ARCHIE Files > Marketing > Logos and Brand > The Book on AHEAD)

### Software to Get
- **Lucid, Glean, Smartsheet, Microsoft Copilot/Copilot Studio** – Request via IT Service Center
- **Windsurf** – Request via IT Service Center (limited licenses as of Feb 2025, expanding)
- **GitHub Enterprise** – Create account with AHEAD email → request access via IT service ticket → get added to AHEAD Labs (agentic-modernization) and Data Science repos (contact Dan Wittenburg for DS repos)
- **Coding Assistants (Cursor etc.)** – Download and expense as needed

### Recurring Meetings to Join
- **Brains Assembly** – General AI talks. Contact: Revo Tesha
- **Tech on Tap** – General tech/AI talks. Contact: Rushda Umrani
- **Hive Friday Meetings** – Internal AI projects (Security, Agentic, Infra, Accelerated Dev). Contact: Erin Hollingshad

## Key Contacts
- **General Onboarding**: onboarding@ahead.com
- **Office Access**: officeaccess@ahead.com
- **AmEx/Concur**: Amanda Piron
- **GitHub/Data Science**: Dan Wittenburg
- **Brains Assembly**: Revo Tesha
- **Tech on Tap**: Rushda Umrani
- **Hive Meetings**: Erin Hollingshad

## Key Systems
- **Okta** – SSO for most apps: https://ahead.okta.com
- **UKGPro** – HR system for time off, documents, payroll
- **KnowBe4** – Compliance training (via Okta)
- **ARCHIE** – AHEAD's intranet: https://archie.ahead.com
- **Concur** – Expense reporting
- **Microsoft Teams** – Primary communication platform
- **GitHub Enterprise** – Code repositories
- **Glean** – Enterprise search (IT can help)

---

Respond in a friendly, helpful, and concise way. When relevant, provide specific links or contact information. 
If someone asks "what should I do first?" or "what's next?", guide them to the most urgent incomplete tasks.
Use markdown formatting for better readability (bold key terms, bullet lists for steps).
Keep responses focused and actionable. If you're unsure about something specific to their role, suggest they ask their manager or contact onboarding@ahead.com.`;
