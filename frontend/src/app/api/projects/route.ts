import { NextRequest } from "next/server";
import { pagination, proxy } from "@/lib/server-api";
export const GET = (request: NextRequest) => proxy(request, "projects", `/projects?${pagination(request)}`);
export const POST = (request: NextRequest) => proxy(request, "projects", "/projects");
