# Schema for Print Production Module (Module 2)

## Concepts
- **Design Project**: Creative work. Ends when file is "Approved".
- **Print Job (Original)**: The Sales Order line item (e.g., 1000 Stickers for Client A).
- **Print Batch (New)**: A manufacturing run. May contain one or MORE Print Jobs (e.g., Client A's Stickers + Client B's Stickers on same sheet).

## New Tables

### 1. `print_batches`
Represents a physical production run.
```sql
create table print_batches (
  id uuid primary key default uuid_generate_v4(),
  batch_number text unique not null,
  
  -- Workflow Configuration
  product_type text not null, -- 'sticker', 'box', 'pouch', 'stationery'
  workflow_stages jsonb not null, -- Array of stages: ['printing', 'lamination', 'die_cutting']
  current_stage_index integer default 0,
  
  -- Machine/Resource Info
  machine_id text, -- Optional FK to machines table
  operator_id uuid references auth.users(id),
  
  -- Scheduling
  status text check (status in ('planning', 'ready', 'in_progress', 'completed', 'on_hold', 'cancelled')),
  priority text default 'normal',
  
  start_date timestamp with time zone,
  due_date timestamp with time zone,
  completed_at timestamp with time zone,
  
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);
```

### 2. `print_batch_items`
Links client jobs to the production batch.
```sql
create table print_batch_items (
  id uuid primary key default uuid_generate_v4(),
  batch_id uuid references print_batches(id) on delete cascade,
  
  job_id uuid references jobs(id), -- The client order
  
  -- Item Specifics for this Batch
  quantity_in_batch integer not null, -- Might specificy partial run? Usually full qty.
  file_url text, -- The specific "Print Ready" file used
  
  created_at timestamp with time zone default now()
);
```

### 3. `machines` (Optional Future)
To track which machine is used (Roland, Komori, etc.)
```sql
create table machines (
  id text primary key, -- e.g. 'printer-01'
  name text,
  type text -- 'offset', 'digital', 'plotter'
);
```

## Workflow Logic (JSONB Structure)
The `workflow_stages` column in `print_batches` stores the sequence.
Example for Stickers:
```json
[
  { "id": "rip", "name": "RIP / Pre-press", "status": "pending" },
  { "id": "print", "name": "Printing", "status": "pending" },
  { "id": "lamination", "name": "Lamination", "status": "pending" },
  { "id": "die_cut", "name": "Die Cutting", "status": "pending" },
  { "id": "quality", "name": "QC", "status": "pending" }
]
```

## Integration with Jobs Table
- `jobs` table should have a `print_status` separate from `current_stage`? 
- OR `jobs.current_stage` updates to `printing` when added to a Batch.
- The `Batch` tracks the granular manufacturing steps (Cutting, Pasting).
- The `Job` tracks high-level Client Status (Design -> Print -> Dispatch).

## Migration/Constraint Handling
Ensure `jobs` table has `print_ready_file_url` or similar to facilitate the handover from Design -> Print.
