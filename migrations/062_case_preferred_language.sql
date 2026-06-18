-- Migration 062: cases.preferred_language — per-case language preference for
-- all client-facing communications (invoices, receipts, payment reminders,
-- overdue notices). Stored on the case rather than the client because the
-- legacy data has multiple client rows per real person (e.g. Ronald
-- Francis Fournier × 9 client UUIDs for his 9 lots), so a per-client flag
-- would only flip one of them. Per-case keeps the toggle unambiguous.
--
-- Default 'es' matches the existing system convention (contracts, receipts,
-- and the operator's locale all default to Spanish). Operators flip the flag
-- to 'en' from the case header for English-preference buyers.

alter table public.cases
  add column if not exists preferred_language text
    not null
    default 'es'
    check (preferred_language in ('es', 'en'));

comment on column public.cases.preferred_language is
  'Per-case language preference for client-facing communications. ''es'' (Spanish, default) or ''en'' (English). Toggled from the case header in CMS; respected by Send Invoice, Send Receipt, Send Email (all reminder/overdue/confirmation templates).';
