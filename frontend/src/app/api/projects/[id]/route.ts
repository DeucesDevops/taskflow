import { NextRequest } from "next/server";
import { json, proxy, validId } from "@/lib/server-api";
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return validId(id) ? proxy(request, "projects", `/projects/${id}`) : json({ error: "Invalid project ID." }, 400);
}

export const PATCH = GET;
export const DELETE = GET;
