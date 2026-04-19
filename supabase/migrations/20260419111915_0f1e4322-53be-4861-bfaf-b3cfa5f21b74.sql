-- Сотрудники школы
create table public.staff (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  role text not null,
  subjects text[] default '{}',
  qualifications text[] default '{}',
  weekly_hours int default 20,
  constraints jsonb default '{}'::jsonb,
  phone text,
  telegram_id text,
  whatsapp text,
  avatar_url text,
  is_active boolean default true,
  created_at timestamptz default now()
);

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  grade int not null,
  letter text not null,
  student_count int default 0,
  created_at timestamptz default now()
);

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,
  name text,
  capacity int default 30,
  type text default 'standard',
  created_at timestamptz default now()
);

create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  short_name text,
  color text default '#3b82f6',
  is_lenta boolean default false
);

create table public.curriculum (
  id uuid primary key default gen_random_uuid(),
  class_id uuid references public.classes(id) on delete cascade,
  subject_id uuid references public.subjects(id) on delete cascade,
  hours_per_week int not null default 1,
  unique(class_id, subject_id)
);

create table public.schedule_slots (
  id uuid primary key default gen_random_uuid(),
  day_of_week int not null,
  period int not null,
  class_id uuid references public.classes(id) on delete cascade,
  subject_id uuid references public.subjects(id),
  teacher_id uuid references public.staff(id),
  room_id uuid references public.rooms(id),
  lenta_group text,
  is_substitution boolean default false,
  original_teacher_id uuid references public.staff(id),
  notes text,
  week_starting date default current_date,
  created_at timestamptz default now()
);
create index idx_slots_day_period on public.schedule_slots(day_of_week, period);
create index idx_slots_teacher on public.schedule_slots(teacher_id);
create index idx_slots_class on public.schedule_slots(class_id);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  assignee_id uuid references public.staff(id),
  created_by uuid references public.staff(id),
  status text default 'pending',
  priority text default 'normal',
  due_date timestamptz,
  source text default 'manual',
  source_message text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.incidents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  location text,
  reported_by text,
  source text default 'telegram',
  source_message text,
  status text default 'open',
  assigned_to uuid references public.staff(id),
  priority text default 'normal',
  created_at timestamptz default now()
);

create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  class_id uuid references public.classes(id) on delete cascade,
  date date not null default current_date,
  present_count int not null default 0,
  absent_count int not null default 0,
  sick_count int default 0,
  reported_by uuid references public.staff(id),
  source text default 'manual',
  notes text,
  created_at timestamptz default now(),
  unique(class_id, date)
);

create table public.nfc_scans (
  id uuid primary key default gen_random_uuid(),
  student_name text not null,
  class_id uuid references public.classes(id),
  card_id text not null,
  scanned_at timestamptz default now(),
  scan_type text default 'entry'
);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  channel text not null,
  chat_name text,
  sender_name text,
  content text,
  parsed_intent text,
  parsed_data jsonb,
  raw jsonb,
  created_at timestamptz default now()
);

create table public.order_templates (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  category text,
  description text,
  template_md text not null,
  fields jsonb default '[]'::jsonb,
  created_at timestamptz default now()
);

create table public.generated_orders (
  id uuid primary key default gen_random_uuid(),
  template_id uuid references public.order_templates(id),
  title text not null,
  content_md text not null,
  status text default 'draft',
  created_by uuid references public.staff(id),
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  title text not null,
  body text,
  payload jsonb,
  is_read boolean default false,
  created_at timestamptz default now()
);

alter table public.staff enable row level security;
alter table public.classes enable row level security;
alter table public.rooms enable row level security;
alter table public.subjects enable row level security;
alter table public.curriculum enable row level security;
alter table public.schedule_slots enable row level security;
alter table public.tasks enable row level security;
alter table public.incidents enable row level security;
alter table public.attendance enable row level security;
alter table public.nfc_scans enable row level security;
alter table public.chat_messages enable row level security;
alter table public.order_templates enable row level security;
alter table public.generated_orders enable row level security;
alter table public.notifications enable row level security;

do $$ declare t text;
begin
  for t in select unnest(array['staff','classes','rooms','subjects','curriculum','schedule_slots','tasks','incidents','attendance','nfc_scans','chat_messages','order_templates','generated_orders','notifications']) loop
    execute format('create policy "demo_select_%I" on public.%I for select using (true);', t, t);
    execute format('create policy "demo_insert_%I" on public.%I for insert with check (true);', t, t);
    execute format('create policy "demo_update_%I" on public.%I for update using (true);', t, t);
    execute format('create policy "demo_delete_%I" on public.%I for delete using (true);', t, t);
  end loop;
end $$;