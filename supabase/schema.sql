-- ============================================================
-- AHEAD Onboarding AI - Supabase Schema
-- Run this in the Supabase SQL editor at supabase.com
-- ============================================================

-- 1. Profiles (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'employee', -- 'employee' | 'admin'
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- 2. User Progress (per-user task completion)
CREATE TABLE IF NOT EXISTS public.user_progress (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  task_id TEXT NOT NULL,
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, task_id)
);
ALTER TABLE public.user_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own progress" ON public.user_progress
  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Admins view all progress" ON public.user_progress
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );


-- 3. Tasks (editable by admins via Admin Panel)
CREATE TABLE IF NOT EXISTS public.tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  priority TEXT NOT NULL DEFAULT 'week1', -- 'urgent' | 'week1' | 'month1'
  due_label TEXT NOT NULL DEFAULT 'Week 1',
  category TEXT NOT NULL DEFAULT 'Getting Started',
  link_label TEXT,
  link_url TEXT,
  sort_order INT DEFAULT 0,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authenticated can read tasks" ON public.tasks
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admins can manage tasks" ON public.tasks
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;
CREATE TRIGGER tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


-- ============================================================
-- SEED: Pre-load all default onboarding tasks
-- ============================================================
INSERT INTO public.tasks (id, title, description, priority, due_label, category, link_label, link_url, sort_order) VALUES
('i9-section1','Complete Section 1 of the I-9 Form','Complete Section 1 of the I-9 form by Monday. Questions? Contact onboarding@ahead.com.','urgent','Due Monday','HR & Compliance','I-9 Instructions','https://archie.ahead.com',1),
('i9-documents','Meet with I-9 Representative','Present your I-9 documents to an I-9 representative by Wednesday.','urgent','Due Wednesday','HR & Compliance','I-9 Instructions','https://archie.ahead.com',2),
('headshot','Upload Headshot to UKGPro','Business casual photo, no distracting backgrounds, no objects obstructing face. Submit an HR Help ticket to upload.','urgent','Due Friday','HR & Compliance','UKGPro HR Help','https://n11.ultipro.com',3),
('compliance-training','Complete Mandatory Compliance Training','Complete your mandatory AHEAD Compliance Training in KnowBe4 (access via Okta).','urgent','Week 1','HR & Compliance','KnowBe4 via Okta','https://ahead.okta.com',4),
('pto-submission','Submit Known PTO in UKG','Submit any known PTO for the month/quarter in UKG.','urgent','Week 1','HR & Compliance','Employee Time Off Guide','https://archie.ahead.com',5),
('new-hire-page','Review New Hire Page on Archie','Go to ARCHIE > Employee Resources and review the New Hire page.','week1','Week 1','Getting Started','ARCHIE','https://archie.ahead.com',6),
('ukg-acknowledge','Acknowledge Key Documents in UKG','Log into UKG > Home (via Okta) and acknowledge all key documents.','week1','Week 1','HR & Compliance','UKG via Okta','https://ahead.okta.com',7),
('new-hire-gifts','Order New Hire Gifts','Fill out the New Hire Gift Order Form to receive your welcome gifts.','week1','Week 1','Getting Started','New Hire Gift Order Form','https://archie.ahead.com',8),
('email-signature','Set Up Email Signature','Configure your professional email signature following AHEAD brand guidelines.','week1','Week 1','Tools & Setup','Email Signature Guidelines','https://archie.ahead.com',9),
('teams-channels','Join Microsoft Teams Channels','Join Teams channels pertinent to your role. Discuss with your manager. Adjust channel-level notifications!','week1','Week 1','Tools & Setup',NULL,NULL,10),
('teams-mobile','Set Up Microsoft Teams on Mobile','Download and set up Microsoft Teams on your mobile device.','week1','Week 1','Tools & Setup',NULL,NULL,11),
('linkedin','Update LinkedIn Profile','Update your LinkedIn profile with your new role at AHEAD. Download LinkedIn Profile Banners from ARCHIE.','week1','Week 1','Tools & Setup','LinkedIn Banners on ARCHIE','https://archie.ahead.com',12),
('overtime-check','Check Overtime Eligibility','Check your offer letter for non-exempt status. If applicable, review the Time Tracking Guide and track time in UKG.','week1','Week 1','HR & Compliance','Time Tracking Guide','https://archie.ahead.com',13),
('office-keycard','Request Office Keycard (if applicable)','Email officeaccess@ahead.com with: full legal name, headshot (150kb+), office locations, mailing address. Include vehicle info for parking.','week1','Week 1','Getting Started','officeaccess@ahead.com','mailto:officeaccess@ahead.com',14),
('github-account','Create GitHub Account with AHEAD Email','Make a GitHub account using your AHEAD email, then request access to GitHub Enterprise via IT service ticket.','week1','Week 1','AI Practice Setup','Request App Access','https://aheadit.service-now.com',15),
('github-repos','Get Added to AHEAD GitHub Repos','Get added to AHEAD Labs (agentic-modernization) and Data Science repos. Contact Dan Wittenburg for Data Science repos.','week1','Week 1','AI Practice Setup','AHEAD Labs GitHub','https://github.com/AHEAD-Labs/agentic-modernization',16),
('software-tools','Request AI Practice Software Access','Request access to: Lucid, Glean, Smartsheet, Microsoft Copilot, Windsurf, and other needed tools.','week1','Week 1','AI Practice Setup','Request App Access - IT','https://aheadit.service-now.com',17),
('read-ai-docs','Read AI Practice Documents','Review IMPACT 2027, Executive Overview, Hatch Sales Plays, Foundry, Enablement Hub, and The Book on AHEAD for Clients.','week1','Week 1','AI Practice Setup','IMPACT 2027','https://archie.ahead.com/sites/impact/sitepagemodern/22125/impact-2027-v2',18),
('benefits','Enroll in Benefits Plan','Enroll in your benefits plan. See ARCHIE > How to Enroll In Benefits.','month1','Month 1','HR & Compliance','Benefits Enrollment Guide','https://archie.ahead.com',19),
('performance-goals','Set Annual Performance Goals','Align with your Manager on Annual Performance and Development Goals in the Learning and Performance Hub.','month1','Month 1','HR & Compliance','Perform to IMPACT','https://archie.ahead.com',20),
('concur-setup','Set Up Concur Profile','Set up your Concur profile for expense reporting and install Concur mobile.','month1','Month 1','Tools & Setup','Concur Expense Guide','https://archie.ahead.com',21),
('certifai','Submit Industry Certifications to CertifAI','Review the ARCHIE CertifAI page and enter your industry certifications.','month1','Month 1','Getting Started','ARCHIE > CertifAI','https://archie.ahead.com',22),
('business-cards','Order Business Cards (if applicable)','Order new AHEAD business cards if applicable to your role via ARCHIE.','month1','Month 1','Getting Started','ARCHIE > Business Cards','https://archie.ahead.com',23),
('meetings-brains','Join Brains Assembly Meeting','General AI talks meeting. Contact Revo Tesha to be added.','month1','Month 1','AI Practice Setup',NULL,NULL,24),
('meetings-hive','Join Hive Friday Meetings','Updates and demos for internal AI projects. Contact Erin Hollingshad.','month1','Month 1','AI Practice Setup',NULL,NULL,25),
('meetings-techontap','Join Tech on Tap Meeting','General tech and AI talks. Contact Rushda Umrani to be added.','month1','Month 1','AI Practice Setup',NULL,NULL,26)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- To make a user an admin, run:
-- UPDATE public.profiles SET role = 'admin' WHERE email = 'your@email.com';
-- ============================================================
