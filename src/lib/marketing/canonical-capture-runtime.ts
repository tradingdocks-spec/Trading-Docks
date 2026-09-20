import chromium from "@sparticuz/chromium-min";
import puppeteer from "puppeteer-core";

export const DEFAULT_CHROMIUM_PACK_URL = "https://github.com/Sparticuz/chromium/releases/download/v153.0.0/chromium-v153.0.0-pack.x64.tar";

export type CanonicalBrowserRuntime = { kind: "local" | "vercel"; executablePath: string; args: string[]; headless: "shell" | true };

export async function resolveCanonicalBrowserRuntime(env: NodeJS.ProcessEnv = process.env): Promise<CanonicalBrowserRuntime> {
  const localExecutable = env.PUPPETEER_EXECUTABLE_PATH ?? env.CHROME_BIN;
  if (localExecutable && env.VERCEL !== "1") return { kind: "local", executablePath: localExecutable, args: [], headless: true };
  if (env.VERCEL !== "1" && env.NODE_ENV !== "production") throw new Error("Local capture requires PUPPETEER_EXECUTABLE_PATH or CHROME_BIN.");
  const executablePath = await chromium.executablePath(env.MARKETING_CHROMIUM_PACK_URL ?? DEFAULT_CHROMIUM_PACK_URL);
  if (!executablePath) throw new Error("Chromium executable path was not resolved.");
  return { kind: "vercel", executablePath, args: await puppeteer.defaultArgs({ args: chromium.args, headless: "shell" }), headless: "shell" };
}
