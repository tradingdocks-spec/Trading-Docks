type WorkspaceMembershipRow = {
  workspace_id?: unknown;
  role?: unknown;
};

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function resolveWorkspaceAccessFromRows(
  explicitWorkspaceId: string | null,
  memberships: WorkspaceMembershipRow[],
) {
  const uniqueMemberships = new Map<string, WorkspaceMembershipRow>();
  for (const membership of memberships) {
    const workspaceId = stringValue(membership.workspace_id);
    if (workspaceId && !uniqueMemberships.has(workspaceId)) uniqueMemberships.set(workspaceId, membership);
  }

  if (explicitWorkspaceId) {
    const activeMembership = uniqueMemberships.get(explicitWorkspaceId);
    return activeMembership
      ? { workspaceId: explicitWorkspaceId, workspaceRole: stringValue(activeMembership.role) }
      : { workspaceId: null, workspaceRole: null };
  }

  if (uniqueMemberships.size === 1) {
    const [workspaceId, membership] = [...uniqueMemberships.entries()][0];
    return { workspaceId, workspaceRole: stringValue(membership.role) };
  }

  return { workspaceId: null, workspaceRole: null };
}
