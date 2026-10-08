import { NextResponse } from "next/server";
import { getGoogleDriveStatus } from "@/lib/google-drive";
import { isAdmin } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await getGoogleDriveStatus(), {
    headers: { "Cache-Control": "private, no-store" },
  });
}
