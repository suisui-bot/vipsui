-- VIPSUI payment provider architecture reference schema.
-- The current storefront did not include a database adapter in this codebase.
-- Keep product, category, source ID, image, and routing data unchanged when wiring this to production storage.

create table if not exists payment_providers (
  provider_name text primary key,
  provider_type text not null,
  enabled boolean not null default false,
  display_name text not null,
  description text,
  payment_instructions text,
  supports_auto_confirmation boolean not null default false,
  supports_refund boolean not null default false,
  supports_webhook boolean not null default false,
  environment text,
  configuration_status text,
  allowed_countries jsonb not null default '["ALL"]',
  public_config jsonb not null default '{}',
  secret_config jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists payments (
  id text primary key,
  order_id text not null,
  provider text not null,
  provider_payment_id text,
  provider_order_id text,
  payment_method text not null,
  amount numeric(12, 2) not null,
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

create unique index if not exists payments_provider_order_unique
  on payments (provider, provider_order_id)
  where provider_order_id is not null;

create table if not exists payment_audit_logs (
  id text primary key,
  payment_id text not null,
  order_id text not null,
  action text not null,
  performed_by text not null,
  previous_status text not null,
  new_status text not null,
  notes text,
  created_at timestamptz not null default now()
);
