// A lost response is an unknown outcome, never a success. Both endpoints accept
// safe retries of the same operation and return the persisted result.
export async function requestInventoryCommit<T>(url: string, method: "POST" | "PATCH", body: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  } catch {
    throw new Error("The commit could not be confirmed. Retry the same operation; it will not be applied twice.");
  }
  const result = await response.json().catch(() => null);
  if (!response.ok || result?.ok !== true) {
    throw new Error(result?.error || "The commit could not be confirmed. Retry the same operation.");
  }
  return result as T;
}
