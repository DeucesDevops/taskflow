import { NextRequest } from "next/server";
import { proxy } from "@/lib/server-api";
export const GET = (request: NextRequest) => proxy(request, "projects", "/projects");
export const POST = (request: NextRequest) => proxy(request, "projects", "/projects");
