import { NextRequest } from "next/server";
import { json, proxy, validId } from "@/lib/server-api";
export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string; userId: string }> }) {
  const { id, userId } = await context.params;
  return validId(id) && validId(userId) ? proxy(request, "projects", `/projects/${id}/members/${userId}`) : json({ error: "Invalid ID." }, 400);
}
