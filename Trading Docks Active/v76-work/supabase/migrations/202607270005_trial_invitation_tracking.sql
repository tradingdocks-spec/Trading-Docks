-- Track Resend trial invitations without exposing API credentials to the browser.
-- Apply after 202607270004_fix_trial_user_permissions.sql.

alter table public.account_trials
  add column if not exists invitation_status text not null default 'not_sent'
    check (invitation_status in ('not_sent', 'pending', 'sent', 'failed')),
  add column if not exists invitation_sent_at timestamptz,
  add column if not exists invitation_email_id text,
  add column if not exists invitation_error text not null default '';

create index if not exists account_trials_invitation_status_idx
on public.account_trials (invitation_status, invitation_sent_at desc);
