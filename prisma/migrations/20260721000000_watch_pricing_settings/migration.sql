create table if not exists pricing_settings (
  scope text primary key,
  shipping_cost_rmb double precision not null default 100,
  packaging_cost_rmb double precision not null default 10,
  payment_fee_percent double precision not null default 4.5,
  exchange_rate_buffer_percent double precision not null default 2,
  risk_reserve_percent double precision not null default 5,
  exchange_rate_rmb_per_usd double precision not null default 7.2,
  profit_multiplier double precision not null default 1.45,
  payment_fee_model text not null default 'cost_reserve',
  created_at timestamp(3) not null default current_timestamp,
  updated_at timestamp(3) not null default current_timestamp
);

insert into pricing_settings (
  scope,
  shipping_cost_rmb,
  packaging_cost_rmb,
  payment_fee_percent,
  exchange_rate_buffer_percent,
  risk_reserve_percent,
  exchange_rate_rmb_per_usd,
  profit_multiplier,
  payment_fee_model
)
values ('watches', 100, 10, 4.5, 2, 5, 7.2, 1.45, 'cost_reserve')
on conflict (scope) do nothing;
