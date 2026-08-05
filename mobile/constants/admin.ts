import type { PlatformRole } from '@/services/access-model';

export type AdminRole = Exclude<PlatformRole, 'user'>;

export const ADMIN_ROLE_LABELS: Record<AdminRole, string> = {
  owner: 'Owner',
  admin: 'Administrator',
  support: 'Support',
  analyst: 'Analyst',
};

export const ADMIN_PERMISSIONS = {
  owner: ['platform.read', 'users.write', 'roles.write', 'plans.write', 'flags.write', 'audit.read'],
  admin: ['platform.read', 'users.write', 'plans.write', 'flags.write', 'audit.read'],
  support: ['platform.read', 'users.read', 'audit.read'],
  analyst: ['platform.read', 'audit.read'],
} as const;
