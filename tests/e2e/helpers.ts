import { expect, type Page, type TestInfo } from "@playwright/test";

export type PageErrorMonitor = {
  consoleErrors: string[];
  pageErrors: string[];
};

const BENIGN_CONSOLE_PATTERNS: RegExp[] = [
  /favicon/i,
];

export const PUBLIC_ROUTES = [
  { path: "/", label: "home" },
  { path: "/pricing", label: "pricing" },
  { path: "/sign-in", label: "sign in" },
  { path: "/sign-up", label: "sign up" },
  { path: "/forgot-password", label: "forgot password" },
  { path: "/update-password", label: "update password" },
  { path: "/privacy", label: "privacy" },
  { path: "/terms", label: "terms" },
  { path: "/security", label: "security" },
] as const;

export function monitorPageErrors(page: Page): PageErrorMonitor {
  const monitor: PageErrorMonitor = {
    consoleErrors: [],
    pageErrors: [],
  };

  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    if (BENIGN_CONSOLE_PATTERNS.some((pattern) => pattern.test(text))) return;
    monitor.consoleErrors.push(text);
  });

  page.on("pageerror", (error) => {
    monitor.pageErrors.push(error.message);
  });

  return monitor;
}

export async function expectNoUnexpectedBrowserErrors(
  monitor: PageErrorMonitor,
) {
  expect.soft(monitor.pageErrors, "uncaught page errors").toEqual([]);
  expect.soft(monitor.consoleErrors, "unexpected console.error output").toEqual([]);
}

export async function expectNoDocumentOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const documentElement = document.documentElement;
    const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
    const offenders: Array<{
      tag: string;
      text: string;
      left: number;
      right: number;
      width: number;
      className: string;
    }> = [];

    const isClippedByScrollableAncestor = (element: HTMLElement, rect: DOMRect) => {
      let current = element.parentElement;
      while (current && current !== document.body) {
        const style = window.getComputedStyle(current);
        if (/(auto|scroll|hidden|clip)/.test(style.overflowX)) {
          const ancestorRect = current.getBoundingClientRect();
          if (ancestorRect.left >= -2 && ancestorRect.right <= viewportWidth + 2) {
            return true;
          }
        }
        current = current.parentElement;
      }
      return false;
    };

    for (const element of Array.from(document.body.querySelectorAll<HTMLElement>("*"))) {
      if (["SCRIPT", "STYLE", "META", "LINK"].includes(element.tagName)) continue;
      if (element.getAttribute("aria-hidden") === "true") continue;
      const style = window.getComputedStyle(element);
      if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") continue;
      const rect = element.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) continue;
      const text = element.innerText?.replace(/\s+/g, " ").trim() ?? "";
      if (!text && ["absolute", "fixed"].includes(style.position)) continue;
      if (isClippedByScrollableAncestor(element, rect)) continue;
      if (rect.right > viewportWidth + 2 || rect.left < -2) {
        offenders.push({
          tag: element.tagName.toLowerCase(),
          text: text.slice(0, 80),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
          className: String(element.className).slice(0, 160),
        });
      }
    }

    return {
      clientWidth: documentElement.clientWidth,
      scrollWidth: documentElement.scrollWidth,
      bodyScrollWidth: document.body?.scrollWidth ?? 0,
      viewportWidth,
      offenders: offenders.slice(0, 10),
    };
  });

  const maxScrollWidth = Math.max(overflow.scrollWidth, overflow.bodyScrollWidth);
  if (overflow.offenders.length === 0) return;
  expect(
    { ...overflow, maxScrollWidth },
    `document-level horizontal overflow: ${JSON.stringify(overflow)}`,
  ).toMatchObject({ offenders: [] });
}

export async function gotoAndAssertLoaded(page: Page, path: string) {
  const response = await page.goto(path, { waitUntil: "domcontentloaded" });
  expect(response?.status(), `${path} response status`).toBeLessThan(400);
  await expect(page.locator("body")).toBeVisible();
}

export async function recordSmallTextAudit(page: Page, testInfo: TestInfo) {
  const suspiciousText = await page.evaluate(() => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
    const suspicious: Array<{ text: string; fontSize: number; tag: string }> = [];

    while (walker.nextNode()) {
      const element = walker.currentNode as HTMLElement;
      const rect = element.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) continue;
      if (element.getAttribute("aria-hidden") === "true") continue;

      const text = element.innerText?.replace(/\s+/g, " ").trim();
      if (!text || text.length < 3) continue;

      const style = window.getComputedStyle(element);
      const fontSize = Number.parseFloat(style.fontSize);
      if (Number.isFinite(fontSize) && fontSize < 10.5) {
        suspicious.push({
          text: text.slice(0, 80),
          fontSize,
          tag: element.tagName.toLowerCase(),
        });
      }
    }

    return suspicious.slice(0, 20);
  });

  if (suspiciousText.length > 0) {
    await testInfo.attach("small-text-audit.json", {
      body: JSON.stringify(suspiciousText, null, 2),
      contentType: "application/json",
    });
  }

  testInfo.annotations.push({
    type: "small-text-audit",
    description: suspiciousText.length
      ? `${suspiciousText.length} visible text elements rendered below 10.5px; see attachment.`
      : "No visible text elements rendered below 10.5px.",
  });
}

export async function openPublicMobileMenu(page: Page) {
  const button = page.locator("header").getByRole("button", { name: /open navigation/i });
  await expect(button).toBeVisible();
  await button.click({ force: true });
  await expect(
    page.locator("header").getByRole("navigation", { name: /mobile site navigation/i }),
  ).toBeVisible();
}
