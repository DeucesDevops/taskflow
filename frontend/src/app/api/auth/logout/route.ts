import { NextRequest, NextResponse } from "next/server";
import { json, mutationGuard, SESSION_COOKIE, upstream } from "@/lib/server-api";

export async function POST(request: NextRequest) {
  const blocked = mutationGuard(request);
  if (blocked) return blocked;
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  let response = new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  try {
    if (token) {
      const result = await upstream("auth", "/auth/logout", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      if (!result.ok && result.status !== 401) throw new Error("Session revocation failed");
    }
  } catch {
    response = json({ error: "You have signed out of this browser. The service could not end the remote session; it will expire automatically." }, 503);
  }
  response.cookies.set(SESSION_COOKIE, "", { httpOnly: true, sameSite: "lax", secure: process.env.SESSION_COOKIE_SECURE === "true", maxAge: 0, path: "/" });
  return response;
}
