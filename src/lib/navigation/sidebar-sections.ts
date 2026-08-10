export const SIDEBAR_SECTION_STORAGE_KEY = "trading-docks-sidebar-open-sections";
export const SIDEBAR_SECTION_STORAGE_VERSION = 1;

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
  return openSidebarSectionsForPath(groups, [fallbackSectionId], pathname);
}

export function normalizeSidebarOpenSections(
  groups: readonly SidebarSectionGroup[],
  openSectionIds: readonly string[],
) {
  const validIds = new Set(groups.map((group) => group.id));
  return [...new Set(openSectionIds.filter((id) => validIds.has(id)))];
}

export function openSidebarSectionsForPath(
  groups: readonly SidebarSectionGroup[],
  openSectionIds: readonly string[],
  pathname: string,
) {
  const activeId = activeSidebarSectionId(groups, pathname);
  return normalizeSidebarOpenSections(
    groups,
    activeId ? [...openSectionIds, activeId] : openSectionIds,
  );
}

export function parseSidebarOpenSections(
  rawValue: string | null,
  groups: readonly SidebarSectionGroup[],
) {
  if (!rawValue) return normalizeSidebarOpenSections(groups, []);
  try {
    const parsed = JSON.parse(rawValue) as unknown;
    if (Array.isArray(parsed)) {
      return normalizeSidebarOpenSections(
        groups,
        parsed.filter((item): item is string => typeof item === "string"),
      );
    }
    if (
      parsed &&
      typeof parsed === "object" &&
      "version" in parsed &&
      "openSectionIds" in parsed &&
      (parsed as { version: unknown }).version === SIDEBAR_SECTION_STORAGE_VERSION &&
      Array.isArray((parsed as { openSectionIds: unknown }).openSectionIds)
    ) {
      return normalizeSidebarOpenSections(
        groups,
        (parsed as { openSectionIds: unknown[] }).openSectionIds.filter(
          (item): item is string => typeof item === "string",
        ),
      );
    }
  } catch {
    // Ignore malformed local UI state and fall back to safe defaults.
  }
  return normalizeSidebarOpenSections(groups, []);
}

export function serializeSidebarOpenSections(openSectionIds: readonly string[]) {
  return JSON.stringify({
    version: SIDEBAR_SECTION_STORAGE_VERSION,
    openSectionIds: [...new Set(openSectionIds)],
  });
}

export function toggleSidebarSection(
  groups: readonly SidebarSectionGroup[],
  openSectionIds: readonly string[],
  sectionId: string,
) {
  if (!groups.some((group) => group.id === sectionId)) return normalizeSidebarOpenSections(groups, openSectionIds);
  const next = new Set(openSectionIds);
  if (next.has(sectionId)) {
    next.delete(sectionId);
  } else {
    next.add(sectionId);
  }
  return normalizeSidebarOpenSections(groups, [...next]);
}
