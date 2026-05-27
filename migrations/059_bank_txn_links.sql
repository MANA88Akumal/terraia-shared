-- Migration 059: bank_transaction_id back-references on settlement-tracking tables
-- Lets the accounting reconciliation Inbox (and the per-row Match column in
-- TransactionsList) record which bank transaction settled a CMS payment, an
-- investor tranche, or a treasury allocation. Already exists for
-- accounting_payment_requests.transaction_id and (after migration 058)
-- accounting_planning_expenses.paid_date.

alter table public.cms_payments
  add column if not exists bank_transaction_id uuid
    references public.accounting_bank_transactions(id) on delete set null;

create index if not exists cms_payments_bank_txn_idx
  on public.cms_payments (bank_transaction_id)
  where bank_transaction_id is not null;

alter table public.investment_tranches
  add column if not exists received_transaction_id uuid
    references public.accounting_bank_transactions(id) on delete set null;

create index if not exists investment_tranches_received_txn_idx
  on public.investment_tranches (received_transaction_id)
  where received_transaction_id is not null;

alter table public.treasury_allocations
  add column if not exists settlement_transaction_id uuid
    references public.accounting_bank_transactions(id) on delete set null;

create index if not exists treasury_allocations_settlement_txn_idx
  on public.treasury_allocations (settlement_transaction_id)
  where settlement_transaction_id is not null;

comment on column public.cms_payments.bank_transaction_id is
  'Optional FK to accounting_bank_transactions.id — set when a client payment is reconciled against a real deposit on a bank statement (Reconciliation Inbox / Match column in TransactionsList).';
comment on column public.investment_tranches.received_transaction_id is
  'Optional FK to accounting_bank_transactions.id — set when an investor tranche has been confirmed received on a bank statement.';
comment on column public.treasury_allocations.settlement_transaction_id is
  'Optional FK to accounting_bank_transactions.id — set when a treasury allocation has been settled via a recorded bank transaction.';
