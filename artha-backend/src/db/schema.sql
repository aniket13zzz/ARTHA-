CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT 'New Business',
  gstin TEXT,
  business_type TEXT,
  owner_telegram_id TEXT UNIQUE NOT NULL,
  language TEXT DEFAULT 'english',
  skill_profile JSONB DEFAULT '{}',
  onboarding_complete BOOLEAN DEFAULT FALSE,
  paperclip_company_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  type TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  party TEXT,
  item TEXT,
  description TEXT,
  quantity DECIMAL(10,2),
  unit TEXT,
  payment_mode TEXT DEFAULT 'unknown',
  gst_amount DECIMAL(12,2) DEFAULT 0,
  raw_message TEXT,
  confidence DECIMAL(3,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id),
  name TEXT NOT NULL,
  name_variants TEXT[] DEFAULT '{}',
  gstin TEXT,
  usual_items TEXT[],
  payment_terms_days INT DEFAULT 30,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id),
  name TEXT NOT NULL,
  phone TEXT,
  gstin TEXT,
  credit_limit DECIMAL(12,2) DEFAULT 0,
  outstanding_balance DECIMAL(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID UNIQUE REFERENCES companies(id),
  telegram_id TEXT NOT NULL,
  last_messages JSONB DEFAULT '[]',
  current_task JSONB DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id),
  action_type TEXT NOT NULL,
  action_payload JSONB NOT NULL,
  status TEXT DEFAULT 'pending',
  paperclip_approval_id TEXT,
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  decided_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id),
  agent TEXT NOT NULL,
  action TEXT NOT NULL,
  payload JSONB,
  result JSONB,
  paperclip_task_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id),
  agent_name TEXT NOT NULL,
  task_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT DEFAULT 'pending',
  result JSONB,
  paperclip_task_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);
