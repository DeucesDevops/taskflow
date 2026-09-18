import { NextRequest } from "next/server";
import { json, proxy, validId } from "@/lib/server-api";
export const POST = (request: NextRequest) => proxy(request, "tasks", "/tasks");
export function GET(request: NextRequest) {
  const projectId = request.nextUrl.searchParams.get("projectId") || "";
  return validId(projectId) ? proxy(request, "tasks", `/tasks?projectId=${projectId}`) : json({ error: "Choose a valid project." }, 400);
}
