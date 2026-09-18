import { NextRequest, NextResponse } from "next/server";

export const SESSION_COOKIE = "taskflow_session";
export const services = {
  auth: process.env.AUTH_SERVICE_URL || "http://localhost:3001",
  projects: process.env.PROJECT_SERVICE_URL || "http://localhost:8080",
  tasks: process.env.TASK_SERVICE_URL || "http://localhost:8081",
  notifications: process.env.NOTIFICATION_SERVICE_URL || "http://localhost:8000",
};

export const json = (data: unknown, status = 200) => NextResponse.json(data, {
  status,
  headers: { "Cache-Control": "no-store" },
});

export function mutationGuard(request: NextRequest): NextResponse | undefined {
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  const expectedOrigin = process.env.APP_ORIGIN || `${request.nextUrl.protocol}//${request.headers.get("host")}`;
  if (fetchSite === "cross-site" || !origin || origin !== expectedOrigin) {
    return json({ error: "This request must come from your TaskFlow workspace." }, 403);
  }
}

export async function upstream(service: keyof typeof services, path: string, options: RequestInit = {}) {
  return fetch(`${services[service]}${path}`, {
    ...options,
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(6000),
  });
}

export async function bodyText(request: NextRequest): Promise<string> {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    throw new Error("Expected a JSON request.");
  }
  const declaredSize = Number(request.headers.get("content-length") || 0);
  if (declaredSize > 16_384) throw new Error("The request is too large.");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("A request body is required.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 16_384) { await reader.cancel(); throw new Error("The request is too large."); }
    chunks.push(value);
  }
  const body = Buffer.concat(chunks).toString("utf8");
  JSON.parse(body);
  return body;
}

export async function proxy(request: NextRequest, service: keyof typeof services, path: string) {
  const mutation = request.method !== "GET";
  if (mutation) {
    const blocked = mutationGuard(request);
    if (blocked) return blocked;
  }
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return json({ error: "Please sign in to continue." }, 401);
  let body: string | undefined;
  if (mutation) {
    try { body = await bodyText(request); }
    catch { return json({ error: "Please send a valid JSON request under 16 KB." }, 400); }
  }
  try {
    const response = await upstream(service, path, {
      method: request.method,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body,
    });
    if (response.status === 204) return new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });
    const payload = await response.json();
    return json(payload, response.status);
  } catch {
    return json({ error: "A workspace service is temporarily unavailable. Please try again." }, 503);
  }
}

export function validId(id: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}
