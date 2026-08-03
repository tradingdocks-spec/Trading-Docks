-- TCGplayer email-to-order processing metadata.
alter table public.inbound_email_messages
  add column if not exists parsed_order_id uuid references public.marketplace_orders(id) on delete set null,
  add column if not exists parser_version text,
  add column if not exists parser_confidence numeric(5,4);

create index if not exists inbound_email_messages_parsed_order_idx
  on public.inbound_email_messages (parsed_order_id)
  where parsed_order_id is not null;

notify pgrst, 'reload schema';
