import { NextRequest } from "next/server";
import { json, pagination, proxy, validId } from "@/lib/server-api";
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return validId(id) ? proxy(request, "projects", `/projects/${id}/members?${pagination(request)}`) : json({ error: "Invalid ID." }, 400);
}
export const POST = GET;
