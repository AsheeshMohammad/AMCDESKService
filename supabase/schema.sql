-- RO Renewal PRO — tenant-isolated Supabase schema.
-- Apply this file in the Supabase SQL editor. Demo UI uses local data and does not
-- require Supabase credentials; this schema is ready for a later backend connection.

create extension if not exists pgcrypto;

create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_name text not null,
  city text not null,
  custom_domain text unique,
  slug text not null unique,
  logo_url text,
  gstin text,
  upi_id text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create or replace function public.current_tenant_id()
returns uuid
language sql
stable
as $$
  select nullif(auth.jwt() -> 'app_metadata' ->> 'tenant_id', '')::uuid
$$;

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  customer_code text not null,
  full_name text not null,
  phone text not null,
  email text,
  address text,
  area text,
  city text,
  created_at timestamptz not null default now(),
  unique (tenant_id, customer_code)
);

create table if not exists public.purifier_units (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  model text not null,
  serial_number text not null,
  installed_at date,
  input_tds integer,
  output_tds integer,
  next_filter_due date,
  filter_lifecycle jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (tenant_id, serial_number)
);

create table if not exists public.technicians (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  full_name text not null,
  phone text,
  area text,
  pin_code text,
  is_active boolean not null default true,
  van_stock jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (tenant_id, phone)
);

create table if not exists public.service_jobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  customer_id uuid not null references public.customers(id),
  purifier_unit_id uuid references public.purifier_units(id),
  technician_id uuid references public.technicians(id),
  job_number text not null,
  service_type text not null check (service_type in ('Installation', 'Routine Filter Change', 'Breakdown Repair', 'AMC Visit')),
  status text not null default 'Scheduled' check (status in ('Scheduled', 'Technician En Route', 'In Progress', 'Completed', 'Cancelled')),
  scheduled_at timestamptz not null,
  input_tds integer,
  output_tds integer,
  spare_parts jsonb not null default '[]'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  unique (tenant_id, job_number)
);

create table if not exists public.amc_contracts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  customer_id uuid not null references public.customers(id),
  purifier_unit_id uuid references public.purifier_units(id),
  contract_number text not null,
  tier text not null check (tier in ('Basic', 'Comprehensive', 'Gold')),
  starts_on date not null,
  ends_on date not null,
  amount numeric(12,2) not null default 0,
  status text not null default 'Active' check (status in ('Active', 'Expiring soon', 'Expired')),
  created_at timestamptz not null default now(),
  unique (tenant_id, contract_number)
);

create table if not exists public.inventory_spares (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  sku text not null,
  name text not null,
  quantity integer not null default 0 check (quantity >= 0),
  minimum_quantity integer not null default 0,
  unit_cost numeric(12,2) not null default 0,
  unit text not null default 'pcs',
  updated_at timestamptz not null default now(),
  unique (tenant_id, sku)
);

create table if not exists public.ro_catalog (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  category text not null,
  mrp numeric(12,2) not null default 0,
  dealer_price numeric(12,2) not null default 0,
  stock_quantity integer not null default 0,
  created_at timestamptz not null default now(),
  unique (tenant_id, name)
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  customer_id uuid not null references public.customers(id),
  invoice_number text not null,
  description text not null,
  subtotal numeric(12,2) not null default 0,
  gst_amount numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  status text not null default 'Pending' check (status in ('Paid', 'Pending', 'Overdue')),
  issued_at date not null default current_date,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  unique (tenant_id, invoice_number)
);

create table if not exists public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  customer_id uuid not null references public.customers(id),
  direction text not null check (direction in ('inbound', 'outbound')),
  body text not null,
  sent_at timestamptz not null default now(),
  delivery_status text not null default 'sent',
  external_message_id text,
  unique (tenant_id, external_message_id)
);

-- Every tenant-owned data table is isolated by the tenant_id claim in Supabase Auth.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'customers', 'purifier_units', 'technicians', 'service_jobs', 'amc_contracts',
    'inventory_spares', 'ro_catalog', 'invoices', 'whatsapp_messages'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('drop policy if exists tenant_isolation on public.%I', table_name);
    execute format(
      'create policy tenant_isolation on public.%I using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id())',
      table_name
    );
  end loop;
end
$$;

alter table public.tenants enable row level security;
drop policy if exists tenant_self_read on public.tenants;
create policy tenant_self_read on public.tenants
  for select using (id = public.current_tenant_id());
drop policy if exists tenant_self_update on public.tenants;
create policy tenant_self_update on public.tenants
  for update using (id = public.current_tenant_id())
  with check (id = public.current_tenant_id());

-- Demo tenant, 17 customers, 5 technicians, 5 visits today and one filter due in 5 days.
with tenant_row as (
  insert into public.tenants (name, owner_name, city, custom_domain, slug, gstin, upi_id)
  values ('SR WATER SOLUTIONS', 'Arif', 'Hyderabad', 'srwatersolutions.in', 'sr-water-solutions', '36ABKFS4821L1Z8', 'srwater@okaxis')
  on conflict (slug) do update set name = excluded.name
  returning id
), names as (
  select * from (values
    ('Ananya Reddy', '9842103600', 'Madhapur'), ('Vikram Rao', '9842103773', 'Kondapur'),
    ('Fatima Khan', '9842103946', 'Gachibowli'), ('Kiran Kumar', '9842104119', 'Kukatpally'),
    ('Priya Sharma', '9842104292', 'Miyapur'), ('Sanjay Gupta', '9842104465', 'Banjara Hills'),
    ('Lakshmi Nair', '9842104638', 'Manikonda'), ('Rahul Verma', '9842104811', 'Hitech City'),
    ('Sana Ahmed', '9842104984', 'Jubilee Hills'), ('Arjun Mehta', '9842105157', 'Secunderabad'),
    ('Nisha Patel', '9842105330', 'Begumpet'), ('Adil Hussain', '9842105503', 'Ameerpet'),
    ('Divya Iyer', '9842105676', 'Nallagandla'), ('Suresh Babu', '9842105849', 'Kompally'),
    ('Neha Joshi', '9842106022', 'Uppal'), ('Imran Ali', '9842106195', 'LB Nagar'),
    ('Pooja Menon', '9842106368', 'Tolichowki')
  ) as n(full_name, phone, area)
), inserted_customers as (
  insert into public.customers (tenant_id, customer_code, full_name, phone, area, city, address)
  select t.id, 'CUS-' || (1042 + row_number() over (order by n.phone) - 1), n.full_name, '+91 ' || n.phone, n.area, 'Hyderabad', n.area || ', Hyderabad'
  from tenant_row t cross join names n
  on conflict (tenant_id, customer_code) do update set full_name = excluded.full_name
  returning id, customer_code, full_name
), inserted_techs as (
  insert into public.technicians (tenant_id, full_name, phone, area, pin_code)
  select t.id, x.full_name, x.phone, x.area, x.pin_code
  from tenant_row t cross join (values
    ('Ramesh Kumar', '+91 98490 10001', 'Madhapur', '500081'),
    ('Sajid Ali', '+91 98490 10002', 'Kondapur', '500084'),
    ('Naveen Reddy', '+91 98490 10003', 'Gachibowli', '500032'),
    ('Mahesh Babu', '+91 98490 10004', 'Kukatpally', '500072'),
    ('Imran Khan', '+91 98490 10005', 'Banjara Hills', '500034')
  ) as x(full_name, phone, area, pin_code)
  on conflict (tenant_id, phone) do update set full_name = excluded.full_name, area = excluded.area, pin_code = excluded.pin_code
  returning id, full_name
), inserted_units as (
  insert into public.purifier_units (tenant_id, customer_id, model, serial_number, installed_at, input_tds, output_tds, next_filter_due)
  select t.id, c.id, (array['Kent Grand Plus','Aquaguard Aura','Pureit Copper+','AO Smith Z9','Livpure Pep Pro'])[row_number() over (order by c.customer_code)::integer % 5 + 1],
    'SRW-2025-' || lpad((10438 + row_number() over (order by c.customer_code)::integer * 137)::text, 5, '0'),
    current_date - interval '250 days', 486, 34,
    case when c.customer_code = 'CUS-1046' then current_date + interval '5 days' else current_date + interval '60 days' end
  from tenant_row t cross join inserted_customers c
  on conflict (tenant_id, serial_number) do nothing
  returning id, customer_id
)
insert into public.amc_contracts (tenant_id, customer_id, purifier_unit_id, contract_number, tier, starts_on, ends_on, amount, status)
select t.id, c.id, u.id, 'AMC-2025-' || c.customer_code, (array['Basic','Comprehensive','Gold'])[row_number() over (order by c.customer_code)::integer % 3 + 1],
  current_date - interval '300 days', current_date + interval '65 days', 8500, 'Active'
from tenant_row t
join inserted_customers c on c.customer_code in ('CUS-1042','CUS-1043','CUS-1044','CUS-1045','CUS-1046','CUS-1047','CUS-1048','CUS-1049','CUS-1050','CUS-1051','CUS-1052','CUS-1053')
join inserted_units u on u.customer_id = c.id
on conflict (tenant_id, contract_number) do nothing;

insert into public.inventory_spares (tenant_id, sku, name, quantity, minimum_quantity, unit_cost) values
((select id from public.tenants where slug = 'sr-water-solutions'), 'FLT-SED-10', 'Sediment Filter 10"', 24, 10, 180),
((select id from public.tenants where slug = 'sr-water-solutions'), 'FLT-CARB-10', 'Pre-carbon Candle', 8, 10, 240),
((select id from public.tenants where slug = 'sr-water-solutions'), 'MEM-75-GPD', 'RO Membrane 75 GPD', 16, 6, 1150),
((select id from public.tenants where slug = 'sr-water-solutions'), 'UV-11W', 'UV Lamp 11W', 5, 8, 620),
((select id from public.tenants where slug = 'sr-water-solutions'), 'PMP-100', 'Booster Pump 100 GPD', 7, 4, 1450),
((select id from public.tenants where slug = 'sr-water-solutions'), 'FIT-ELB-14', 'John Guest Elbow 1/4"', 42, 20, 35)
on conflict (tenant_id, sku) do nothing;

insert into public.ro_catalog (tenant_id, name, category, mrp, dealer_price, stock_quantity) values
((select id from public.tenants where slug = 'sr-water-solutions'), 'AquaPure RO+UV Elite', 'Residential · 7 stage', 18999, 12499, 12),
((select id from public.tenants where slug = 'sr-water-solutions'), 'CrystalFlow Copper Max', 'Residential · Copper + RO', 24999, 16800, 7),
((select id from public.tenants where slug = 'sr-water-solutions'), 'HydroPro Commercial 50 LPH', 'Commercial · 50 LPH', 68999, 48200, 3)
on conflict (tenant_id, name) do nothing;

-- Idempotent demo invoice total: ₹84,503 collected this month.
with t as (select id from public.tenants where slug = 'sr-water-solutions'),
c as (select id, customer_code from public.customers where tenant_id = (select id from t))
insert into public.invoices (tenant_id, customer_id, invoice_number, description, subtotal, gst_amount, total, status, issued_at, paid_at)
select t.id, c.id, i.invoice_number, i.description, i.total / 1.18, i.total - (i.total / 1.18), i.total, i.status, current_date, now()
from t cross join (values
  ('CUS-1042','INV-2025-0841','AMC Renewals',24500::numeric,'Paid'),
  ('CUS-1043','INV-2025-0840','Annual maintenance',18500::numeric,'Paid'),
  ('CUS-1044','INV-2025-0839','Filter replacements',14999::numeric,'Paid'),
  ('CUS-1045','INV-2025-0838','Service visits',11999::numeric,'Paid'),
  ('CUS-1046','INV-2025-0837','RO purifier sale',8500::numeric,'Paid'),
  ('CUS-1047','INV-2025-0836','Repairs and spares',6005::numeric,'Paid')
) as i(customer_code, invoice_number, description, total, status)
join c on c.customer_code = i.customer_code
on conflict (tenant_id, invoice_number) do nothing;

with t as (select id from public.tenants where slug = 'sr-water-solutions'),
c as (select id, customer_code from public.customers where tenant_id = (select id from t)),
u as (select id, customer_id from public.purifier_units where tenant_id = (select id from t)),
tech as (select id, full_name from public.technicians where tenant_id = (select id from t))
insert into public.service_jobs (tenant_id, customer_id, purifier_unit_id, technician_id, job_number, service_type, status, scheduled_at, input_tds, output_tds)
select t.id, c.id, u.id, tech.id, j.job_number, j.service_type, j.status, current_date + j.visit_time::time, j.input_tds, j.output_tds
from t cross join (values
  ('CUS-1042','Ramesh Kumar','JOB-2841','Routine Filter Change','Completed','09:30','486','34'),
  ('CUS-1043','Sajid Ali','JOB-2842','AMC Visit','In Progress','10:30','520','42'),
  ('CUS-1044','Naveen Reddy','JOB-2843','Breakdown Repair','Technician En Route','11:30','610','28'),
  ('CUS-1045','Mahesh Babu','JOB-2844','Routine Filter Change','Scheduled','14:00','455','51'),
  ('CUS-1046','Imran Khan','JOB-2845','AMC Visit','Scheduled','16:00','390','36')
) as j(customer_code, technician_name, job_number, service_type, status, visit_time, input_tds, output_tds)
join c on c.customer_code = j.customer_code
join tech on tech.full_name = j.technician_name
left join u on u.customer_id = c.id
on conflict (tenant_id, job_number) do nothing;

insert into public.whatsapp_messages (tenant_id, customer_id, direction, body, sent_at, external_message_id)
select t.id, c.id, msg.direction, msg.body, now() - msg.age::interval, msg.message_id
from public.tenants t
join public.customers c on c.tenant_id = t.id and c.customer_code = 'CUS-1042'
cross join (values
  ('inbound','Hi, I think my purifier needs a filter change. The water flow has become slow.','20 minutes','seed-CUS-1042-1'),
  ('outbound','Hi Ananya! I can help with that. I will check the service schedule for your area.','18 minutes','seed-CUS-1042-2'),
  ('inbound','Can you send someone today?','10 minutes','seed-CUS-1042-3')
) as msg(direction, body, age, message_id)
where t.slug = 'sr-water-solutions';
