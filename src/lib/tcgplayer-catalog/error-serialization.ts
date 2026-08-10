export type SerializedCatalogError = {
  name?: string;
  message: string;
  stack?: string;
  code?: unknown;
  details?: unknown;
  hint?: unknown;
  status?: unknown;
  statusCode?: unknown;
  cause?: SerializedCatalogError;
};

export function serializeError(error: unknown): SerializedCatalogError {
  if (error instanceof Error) {
    const record = error as Error & {
      code?: unknown;
      details?: unknown;
      hint?: unknown;
      status?: unknown;
      statusCode?: unknown;
      originalError?: unknown;
    };
    return {
      name: error.name,
      message: error.message || "Unknown error",
      stack: error.stack,
      code: record.code,
      details: record.details,
      hint: record.hint,
      status: record.status,
      statusCode: record.statusCode,
      cause: record.originalError === undefined ? undefined : serializeError(record.originalError),
    };
  }
  if (typeof error === "string") {
    return { message: error.trim() || "Unknown error" };
  }
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    return {
      message:
        stringValue(record.message) ||
        stringValue(record.error) ||
        jsonValue(error) ||
        "Unknown error",
      code: record.code,
      details: record.details,
      hint: record.hint,
      status: record.status,
      statusCode: record.statusCode,
    };
  }
  return { message: String(error ?? "Unknown error") || "Unknown error" };
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function jsonValue(value: unknown) {
  try {
    const serialized = JSON.stringify(value);
    return serialized && serialized !== "{}" ? serialized : "";
  } catch {
    return "";
  }
}
