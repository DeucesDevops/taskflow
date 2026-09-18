import { json, services } from "@/lib/server-api";
export const dynamic = "force-dynamic";
export async function GET() {
  const checks = await Promise.all(Object.entries(services).map(async ([service, url]) => {
    try {
      const response = await fetch(`${url}/ready`, { cache: "no-store", redirect: "error", signal: AbortSignal.timeout(3500) });
      return [service, response.ok ? "ok" : "unavailable"];
    } catch { return [service, "unavailable"]; }
  }));
  const ready = checks.every(([, status]) => status === "ok");
  return json({ status: ready ? "ok" : "unavailable", service: "frontend", dependencies: Object.fromEntries(checks) }, ready ? 200 : 503);
}
