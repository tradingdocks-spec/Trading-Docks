-- Run once in Supabase SQL Editor before deploying v180.
alter table public.inbound_email_mailboxes
  add column if not exists email_provider text not null default 'gmail',
  add column if not exists marketplace_id text not null default 'tcgplayer';

notify pgrst, 'reload schema';
