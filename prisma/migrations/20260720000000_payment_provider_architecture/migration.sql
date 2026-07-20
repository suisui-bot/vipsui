create table if not exists admin_users (
  id text primary key,
  email text not null unique,
  name text not null,
  password_hash text not null,
  role text not null default 'admin',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists admin_sessions (
  id text primary key,
  user_id text not null references admin_users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index if not exists admin_sessions_user_id_idx on admin_sessions(user_id);
create index if not exists admin_sessions_expires_at_idx on admin_sessions(expires_at);

create table if not exists customers (
  id text primary key,
  name text not null,
  country text not null,
  whatsapp text,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists quick_orders (
  id text primary key,
  order_number text not null unique,
  checkout_token text not null unique,
  customer_id text not null references customers(id),
  subtotal double precision not null,
  shipping double precision not null,
  discount double precision not null,
  total double precision not null,
  currency text not null default 'USD',
  payment_status text not null default 'unpaid',
  order_status text not null default 'awaiting_payment',
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists quick_orders_customer_id_idx on quick_orders(customer_id);
create index if not exists quick_orders_payment_status_idx on quick_orders(payment_status);
create index if not exists quick_orders_order_status_idx on quick_orders(order_status);

create table if not exists order_items (
  id text primary key,
  order_id text not null references quick_orders(id) on delete cascade,
  product_id text,
  image text not null,
  name text not null,
  product_number text not null,
  specs text not null,
  quantity integer not null,
  unit_price double precision not null
);

create index if not exists order_items_order_id_idx on order_items(order_id);

create table if not exists payment_providers (
  provider_name text primary key,
  provider_type text not null,
  enabled boolean not null default false,
  display_name text not null,
  description text not null,
  payment_instructions text not null,
  supports_auto_confirmation boolean not null default false,
  supports_refund boolean not null default false,
  supports_webhook boolean not null default false,
  environment text not null,
  configuration_status text not null,
  allowed_countries jsonb not null default '["ALL"]',
  public_config jsonb not null default '{}',
  secret_preview jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists payments (
  id text primary key,
  order_id text not null references quick_orders(id) on delete cascade,
  provider text not null,
  provider_payment_id text,
  provider_order_id text,
  payment_method text not null,
  amount double precision not null,
  currency text not null default 'USD',
  status text not null,
  manual_verification_required boolean not null default false,
  submitted_at timestamptz,
  verified_at timestamptz,
  verified_by text,
  failed_reason text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists payments_provider_order_id_unique
  on payments(provider, provider_order_id)
  where provider_order_id is not null;
create index if not exists payments_order_id_idx on payments(order_id);
create index if not exists payments_provider_idx on payments(provider);
create index if not exists payments_status_idx on payments(status);

create table if not exists payment_audit_logs (
  id text primary key,
  payment_id text not null references payments(id) on delete cascade,
  order_id text not null references quick_orders(id) on delete cascade,
  action text not null,
  performed_by text not null,
  previous_status text not null,
  new_status text not null,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists payment_audit_logs_payment_id_idx on payment_audit_logs(payment_id);
create index if not exists payment_audit_logs_order_id_idx on payment_audit_logs(order_id);

create table if not exists processed_webhooks (
  id text primary key,
  provider text not null,
  processed_at timestamptz not null default now(),
  payload jsonb
);

create index if not exists processed_webhooks_provider_idx on processed_webhooks(provider);
