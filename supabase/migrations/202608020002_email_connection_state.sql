-- Persist the email provider and marketplace represented by each workspace inbox.
alter table public.inbound_email_mailboxes
  add column if not exists email_provider text not null default 'gmail',
  add column if not exists marketplace_id text not null default 'tcgplayer';

notify pgrst, 'reload schema';
