export const SIDEBAR_SECTION_STORAGE_KEY = "trading-docks-sidebar-open-sections";

export type SidebarSectionRoute = {
  href: string;
};

export type SidebarSectionGroup = {
  id: string;
  items: readonly SidebarSectionRoute[];
};

export function sidebarSectionContainsPath(
  group: SidebarSectionGroup,
  pathname: string,
) {
  return group.items.some((item) =>
    item.href === "/dashboard"
      ? pathname === item.href
      : pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
}

export function activeSidebarSectionId(
  groups: readonly SidebarSectionGroup[],
  pathname: string,
) {
  return groups.find((group) => sidebarSectionContainsPath(group, pathname))?.id ?? null;
}

export function defaultSidebarOpenSections(
  groups: readonly SidebarSectionGroup[],
  pathname: string,
  fallbackSectionId = "collector",
) {
  return normalizeSidebarOpenSections(groups, [fallbackSectionId], pathname);
}

export function normalizeSidebarOpenSections(
  groups: readonly SidebarSectionGroup[],
  openSectionIds: readonly string[],
  pathname: string,
) {
  const validIds = new Set(groups.map((group) => group.id));
  const activeId = activeSidebarSectionId(groups, pathname);
  const normalized = new Set(openSectionIds.filter((id) => validIds.has(id)));
  if (activeId) normalized.add(activeId);
  if (!normalized.size && validIds.has("collector")) normalized.add("collector");
  return [...normalized];
}

export function parseSidebarOpenSections(
  rawValue: string | null,
  groups: readonly SidebarSectionGroup[],
  pathname: string,
) {
  if (!rawValue) return defaultSidebarOpenSections(groups, pathname);
  try {
    const parsed = JSON.parse(rawValue) as unknown;
    if (Array.isArray(parsed)) {
      return normalizeSidebarOpenSections(
        groups,
        parsed.filter((item): item is string => typeof item === "string"),
        pathname,
      );
    }
  } catch {
    // Ignore malformed local UI state and fall back to safe defaults.
  }
  return defaultSidebarOpenSections(groups, pathname);
}

export function serializeSidebarOpenSections(openSectionIds: readonly string[]) {
  return JSON.stringify([...new Set(openSectionIds)]);
}

export function toggleSidebarSection(
  groups: readonly SidebarSectionGroup[],
  openSectionIds: readonly string[],
  sectionId: string,
  pathname: string,
) {
  if (activeSidebarSectionId(groups, pathname) === sectionId) {
    return normalizeSidebarOpenSections(groups, openSectionIds, pathname);
  }
  const next = new Set(openSectionIds);
  if (next.has(sectionId)) {
    next.delete(sectionId);
  } else {
    next.add(sectionId);
  }
  return normalizeSidebarOpenSections(groups, [...next], pathname);
}
