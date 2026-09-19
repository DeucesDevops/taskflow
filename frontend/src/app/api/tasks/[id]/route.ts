import { NextRequest } from "next/server";
import { json, proxy, validId } from "@/lib/server-api";
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return validId(id) ? proxy(request, "tasks", `/tasks/${id}`) : json({ error: "Invalid task ID." }, 400);
}
export const GET = PATCH;
export const DELETE = PATCH;
