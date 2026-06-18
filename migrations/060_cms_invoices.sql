-- Migration 060: cms_invoices — client-facing invoices generated for upcoming
-- (or overdue) payments. Distinct from cms_payments (which record cash
-- received) and from receipts (which confirm a completed payment).
--
-- An invoice's primary item is one payment_schedule row; line_items also lists
-- any carry-forward shortfalls from prior partial rows so the total reflects
-- what the client actually owes right now. Once payment lands, the receipt
-- flow links the cms_payments row back via cms_payments.invoice_id.

create table if not exists public.cms_invoices (
  id                  uuid primary key default gen_random_uuid(),
  invoice_number      text not null unique,
  case_id             uuid not null references public.cases(id) on delete cascade,
  schedule_item_id    uuid references public.payment_schedule(id) on delete set null,
  generated_at        timestamptz not null default now(),
  sent_at             timestamptz,
  pdf_url             text,
  pdf_filename        text,
  line_items          jsonb not null default '[]'::jsonb,
  subtotal_mxn        numeric(14,2) not null default 0,
  total_mxn           numeric(14,2) not null default 0,
  due_date            date,
  status              text not null default 'draft'
                        check (status in ('draft','sent','paid','void')),
  voided_at           timestamptz,
  voided_reason       text,
  notes               text,
  tenant_id           uuid not null,
  org_id              uuid not null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists cms_invoices_case_idx
  on public.cms_invoices (case_id, generated_at desc);

create index if not exists cms_invoices_schedule_idx
  on public.cms_invoices (schedule_item_id)
  where schedule_item_id is not null;

create index if not exists cms_invoices_status_idx
  on public.cms_invoices (status)
  where status in ('draft','sent');

-- Back-reference from cms_payments so we can show "Receipt for Invoice #X"
-- and so the receipt flow links the receipt back to the invoice that
-- triggered it. Optional — receipts can still be issued without an invoice.
alter table public.cms_payments
  add column if not exists invoice_id uuid
    references public.cms_invoices(id) on delete set null;

create index if not exists cms_payments_invoice_idx
  on public.cms_payments (invoice_id)
  where invoice_id is not null;

-- updated_at auto-touch trigger
create or replace function public.touch_cms_invoices_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists cms_invoices_touch_updated on public.cms_invoices;
create trigger cms_invoices_touch_updated
  before update on public.cms_invoices
  for each row execute function public.touch_cms_invoices_updated_at();

-- RLS
alter table public.cms_invoices enable row level security;

drop policy if exists cms_invoices_tenant_isolation on public.cms_invoices;
create policy cms_invoices_tenant_isolation
  on public.cms_invoices
  for all
  using (tenant_id = public.get_current_tenant_id())
  with check (tenant_id = public.get_current_tenant_id());

-- Service-role policy so server-side scripts and Edge Functions can manage
-- invoices regardless of JWT context (mirrors the convention used by
-- cms_payments and payment_schedule).
drop policy if exists cms_invoices_service_role on public.cms_invoices;
create policy cms_invoices_service_role
  on public.cms_invoices
  for all
  to service_role
  using (true)
  with check (true);

comment on table public.cms_invoices is
  'Client-facing invoices generated from the CMS. Each invoice references a primary payment_schedule row plus any carry-forward shortfalls in line_items. Once paid, cms_payments.invoice_id links back so receipts can reference the invoice number.';

comment on column public.cms_invoices.line_items is
  'JSONB array of {label, amount_mxn, source_schedule_id?, kind: "current" | "carry_forward"}. The first item is always the primary schedule row being invoiced; subsequent items are carry-forward shortfalls from prior partial/overdue rows that have NOT been deferred.';

comment on column public.cms_invoices.status is
  'draft = generated but not sent; sent = emailed to client; paid = a cms_payments row references this invoice and fully covers total_mxn; void = cancelled / superseded.';
