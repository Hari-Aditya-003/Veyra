import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { getAlbumById } from "@/lib/data";
import { hashGuestPassword, isAdmin, randomCode } from "@/lib/security";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  if (!(await getAlbumById(id))) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  const guestUsername = `guest-${randomCode(5).toLowerCase()}`;
  const guestPassword = randomCode(10);
  const guestPasswordHash = await hashGuestPassword(id, guestPassword);

  await env.DB.prepare(
    "UPDATE albums SET guest_username = ?, guest_password_hash = ? WHERE id = ?",
  ).bind(guestUsername, guestPasswordHash, id).run();

  return NextResponse.json({ guestUsername, guestPassword });
}
