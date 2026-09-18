import { NextRequest } from "next/server";
import { bodyText, json, mutationGuard, SESSION_COOKIE, upstream } from "@/lib/server-api";

export async function POST(request: NextRequest) {
  const blocked = mutationGuard(request);
  if (blocked) return blocked;
  let body: string;
  try { body = await bodyText(request); }
  catch { return json({ error: "Enter a valid email and password." }, 400); }
  try {
    const response = await upstream("auth", "/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body });
    const result = await response.json();
    if (!response.ok) return json({ error: result.error || "Unable to sign in." }, response.status);
    if (typeof result.token !== "string" || !result.user) throw new Error("Invalid auth response");
    const output = json({ user: result.user });
    output.cookies.set(SESSION_COOKIE, result.token, {
      httpOnly: true,
      secure: process.env.SESSION_COOKIE_SECURE === "true",
      sameSite: "lax",
      maxAge: 24 * 60 * 60,
      path: "/",
    });
    return output;
  } catch {
    return json({ error: "Sign-in is temporarily unavailable. Please try again." }, 503);
  }
}
