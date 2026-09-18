import { json } from "@/lib/server-api";
export const dynamic = "force-dynamic";
export const GET = () => json({ status: "ok", service: "frontend" });
