export const typography = {
  display: "td-type-display",
  pageTitle: "td-type-page-title",
  sectionTitle: "td-type-section-title",
  cardTitle: "td-type-card-title",
  body: "td-type-body",
  bodySmall: "td-type-body-small",
  caption: "td-type-caption",
  overline: "td-type-overline",
} as const;

export type TypographyToken = keyof typeof typography;
