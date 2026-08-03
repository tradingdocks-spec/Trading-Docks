-- One permanent inbound mailbox address per Trading Docks workspace.

alter table public.inbound_email_mailboxes
  add column if not exists rotation_count integer not null default 0,
  add column if not exists rotated_at timestamptz;

create unique index if not exists inbound_email_mailboxes_one_per_workspace
  on public.inbound_email_mailboxes (workspace_id);

comment on column public.inbound_email_mailboxes.address_token is
  'Permanent workspace inbound token. Change only after explicit administrator rotation confirmation.';

comment on column public.inbound_email_mailboxes.rotation_count is
  'Number of explicit administrator-requested rotations.';

notify pgrst, 'reload schema';
