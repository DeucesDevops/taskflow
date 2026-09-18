import { NextRequest } from "next/server";
import { proxy } from "@/lib/server-api";
export const GET = (request: NextRequest) => proxy(request, "notifications", "/notifications");
