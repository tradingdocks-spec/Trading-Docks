import path from "node:path";

export type QaAccountTier =
  | "default"
  | "free"
  | "collector"
  | "seller"
  | "store"
  | "owner";

export type QaAccount = {
  tier: QaAccountTier;
  label: string;
  email?: string;
  password?: string;
  statePath: string;
};

const AUTH_STATE_DIR = path.join(process.cwd(), ".playwright-auth");

const ACCOUNT_ENV: Array<{
  tier: QaAccountTier;
  label: string;
  emailEnv: string;
  passwordEnv: string;
}> = [
  {
    tier: "default",
    label: "Representative account",
    emailEnv: "PLAYWRIGHT_AUTH_EMAIL",
    passwordEnv: "PLAYWRIGHT_AUTH_PASSWORD",
  },
  {
    tier: "free",
    label: "Free account",
    emailEnv: "PLAYWRIGHT_FREE_EMAIL",
    passwordEnv: "PLAYWRIGHT_FREE_PASSWORD",
  },
  {
    tier: "collector",
    label: "Collector account",
    emailEnv: "PLAYWRIGHT_COLLECTOR_EMAIL",
    passwordEnv: "PLAYWRIGHT_COLLECTOR_PASSWORD",
  },
  {
    tier: "seller",
    label: "Seller account",
    emailEnv: "PLAYWRIGHT_SELLER_EMAIL",
    passwordEnv: "PLAYWRIGHT_SELLER_PASSWORD",
  },
  {
    tier: "store",
    label: "Store account",
    emailEnv: "PLAYWRIGHT_STORE_EMAIL",
    passwordEnv: "PLAYWRIGHT_STORE_PASSWORD",
  },
  {
    tier: "owner",
    label: "Owner/Admin account",
    emailEnv: "PLAYWRIGHT_OWNER_EMAIL",
    passwordEnv: "PLAYWRIGHT_OWNER_PASSWORD",
  },
];

export const QA_ACCOUNTS: QaAccount[] = ACCOUNT_ENV.map((account) => ({
  tier: account.tier,
  label: account.label,
  email: process.env[account.emailEnv],
  password: process.env[account.passwordEnv],
  statePath: path.join(AUTH_STATE_DIR, `${account.tier}.json`),
}));

export const CONFIGURED_QA_ACCOUNTS = QA_ACCOUNTS.filter(
  (account) => account.email && account.password,
);

export const REPRESENTATIVE_QA_ACCOUNT =
  QA_ACCOUNTS.find((account) => account.tier === "default" && account.email && account.password) ??
  CONFIGURED_QA_ACCOUNTS[0];

export function describeConfiguredAccounts() {
  return CONFIGURED_QA_ACCOUNTS.map((account) => account.label).join(", ");
}
