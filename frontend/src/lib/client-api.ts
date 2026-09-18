export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...options,
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const payload = response.status === 204 ? undefined : await response.json();
  if (!response.ok) throw new ApiError(payload?.error || "Something went wrong. Please try again.", response.status);
  return payload as T;
}
