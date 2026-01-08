-- Create tables for Design Projects module

CREATE TABLE IF NOT EXISTS design_projects (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_number text NOT NULL,
  name text NOT NULL,
  description text,
  client_id uuid REFERENCES clients(id),
  
  -- We'll store designer IDs as a text array because complex many-to-many is overkill for now
  designer_ids text[], 
  
  start_date date,
  end_date date,
  status text DEFAULT 'planning',
  progress integer DEFAULT 0,
  drive_link text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS design_tasks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid REFERENCES design_projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  status text DEFAULT 'pending',
  progress integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Disable RLS
ALTER TABLE design_projects DISABLE ROW LEVEL SECURITY;
ALTER TABLE design_tasks DISABLE ROW LEVEL SECURITY;

-- Counter for project numbers
INSERT INTO counters (id, current_number, prefix) 
VALUES ('design_project', 100, 'PRJ-') 
ON CONFLICT (id) DO NOTHING;
