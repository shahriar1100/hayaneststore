-- ============================================================================
-- HayaNest BD E-Commerce — High-Traffic PostgreSQL Schema for Supabase
-- Run this script in: Supabase Dashboard -> SQL Editor -> New Query -> Run
-- ============================================================================

-- 1. Products Table
create table if not exists public.products (
  id text primary key,
  slug text not null unique,
  sku text not null default '',
  name text not null,
  description text not null default '',
  price numeric(12, 2) not null check (price >= 0),
  original_price numeric(12, 2) check (original_price is null or original_price >= price),
  cost_price numeric(12, 2) check (cost_price is null or cost_price >= 0),
  status text not null default 'active' check (status in ('active', 'inactive')),
  category text not null default 'hijabs',
  fabric text,
  colour text not null default 'rose',
  stock integer not null default 10 check (stock >= 0),
  low_stock_threshold integer not null default 5 check (low_stock_threshold >= 0),
  material text not null default 'Modal',
  size text not null default '180 × 70 cm',
  delivery_note text not null default 'Delivery within 1–3 business days inside Dhaka and 3–5 days nationwide.',
  image_src text not null,
  image_alt text not null,
  image_position text,
  sections text[] not null default '{}',
  variants jsonb not null default '[]'::jsonb,
  last_restocked_at timestamptz,
  added_at date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Drop legacy hardcoded taxonomy CHECK constraints if upgrading an existing database
alter table public.products drop constraint if exists products_category_check;
alter table public.products drop constraint if exists products_fabric_check;
alter table public.products drop constraint if exists products_colour_check;

-- High-traffic indexes for fast filtering, sorting, and homepage section lookups
create index if not exists idx_products_category on public.products (category);
create index if not exists idx_products_fabric on public.products (fabric);
create index if not exists idx_products_colour on public.products (colour);
create index if not exists idx_products_status on public.products (status);
create index if not exists idx_products_added_at on public.products (added_at desc, created_at desc);
create index if not exists idx_products_sections on public.products using gin (sections);

-- 2. Orders Table
create table if not exists public.orders (
  id text primary key,
  customer_name text not null,
  customer_phone text not null,
  customer_email text,
  customer_address text not null,
  customer_city text not null,
  customer_notes text,
  delivery_zone text not null check (delivery_zone in ('inside-dhaka', 'outside-dhaka')),
  payment_method text not null check (payment_method in ('cod', 'bkash', 'nagad')),
  payment_phone text,
  payment_status text not null default 'Pending' check (payment_status in ('Paid', 'Pending', 'Failed', 'Refunded', 'Partially Refunded')),
  delivery_status text not null default 'Pending Dispatch' check (delivery_status in ('Pending Dispatch', 'In Transit', 'Out for Delivery', 'Delivered', 'Returned', 'Cancelled')),
  items jsonb not null default '[]'::jsonb,
  subtotal numeric(12, 2) not null check (subtotal >= 0),
  discount_amount numeric(12, 2) not null default 0 check (discount_amount >= 0),
  coupon_code text,
  shipping_fee numeric(12, 2) not null check (shipping_fee >= 0),
  tax_amount numeric(12, 2) not null default 0 check (tax_amount >= 0),
  refund_amount numeric(12, 2) not null default 0 check (refund_amount >= 0),
  total numeric(12, 2) not null check (total >= 0),
  status text not null default 'Confirmed' check (status in ('Pending', 'Confirmed', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Returned', 'Refunded')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_orders_created_at on public.orders (created_at desc);
create index if not exists idx_orders_customer_phone on public.orders (customer_phone);
create index if not exists idx_orders_status on public.orders (status);
create index if not exists idx_orders_payment_status on public.orders (payment_status);

-- 3. Coupons Table
create table if not exists public.coupons (
  id text primary key,
  code text not null unique,
  description text not null default '',
  discount_type text not null default 'percentage' check (discount_type in ('percentage', 'fixed')),
  discount_value numeric(12, 2) not null check (discount_value >= 0),
  min_order_amount numeric(12, 2) not null default 0 check (min_order_amount >= 0),
  active boolean not null default true,
  usage_count integer not null default 0 check (usage_count >= 0),
  created_at timestamptz not null default now()
);

-- 4. Auto-update `updated_at` trigger
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_products_updated_at on public.products;
create trigger trg_products_updated_at
before update on public.products
for each row execute function public.set_updated_at();

drop trigger if exists trg_orders_updated_at on public.orders;
create trigger trg_orders_updated_at
before update on public.orders
for each row execute function public.set_updated_at();

-- 4. Reviews Table
create table if not exists public.reviews (
  id text primary key,
  product_id text not null references public.products(id) on delete cascade,
  order_id text references public.orders(id) on delete set null,
  customer_name text not null,
  customer_phone text,
  rating integer not null check (rating >= 1 and rating <= 5),
  title text not null default '',
  comment text not null,
  status text not null default 'approved' check (status in ('pending', 'approved', 'rejected')),
  verified_purchase boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_reviews_product_id on public.reviews (product_id);
create index if not exists idx_reviews_status on public.reviews (status);
create index if not exists idx_reviews_created_at on public.reviews (created_at desc);

-- 5. Row Level Security (RLS)
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.coupons enable row level security;
alter table public.reviews enable row level security;

-- Public visitors can read active products seamlessly
drop policy if exists "Public can view products" on public.products;
create policy "Public can view products"
  on public.products
  for select
  to anon, authenticated
  using (true);

-- Customers (including guest checkout) can create orders
drop policy if exists "Anyone can place orders" on public.orders;
create policy "Anyone can place orders"
  on public.orders
  for insert
  to anon, authenticated
  with check (true);

-- Public can view approved reviews
drop policy if exists "Public can view approved reviews" on public.reviews;
create policy "Public can view approved reviews"
  on public.reviews
  for select
  to anon, authenticated
  using (status = 'approved');

-- Customers can submit reviews
drop policy if exists "Anyone can submit reviews" on public.reviews;
create policy "Anyone can submit reviews"
  on public.reviews
  for insert
  to anon, authenticated
  with check (true);
