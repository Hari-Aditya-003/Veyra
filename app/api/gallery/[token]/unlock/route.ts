import { NextResponse } from "next/server";
import { createGallerySession, hashGuestPassword } from "@/lib/security";
import { getAlbumByToken } from "@/lib/data";

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const album = await getAlbumByToken(token);
  if (!album) return NextResponse.redirect(new URL("/", request.url), 303);
  const form = await request.formData();
  const username = String(form.get("username") ?? "");
  const password = String(form.get("password") ?? "");
  const valid = username === album.guest_username &&
    (await hashGuestPassword(album.id, password)) === album.guest_password_hash;
  if (!valid) return NextResponse.redirect(new URL(`/g/${token}?error=invalid`, request.url), 303);

  const response = NextResponse.redirect(new URL(`/g/${token}`, request.url), 303);
  response.cookies.set(`veyra_gallery_${album.id}`, await createGallerySession(album.id), {
    httpOnly: true, secure: new URL(request.url).protocol === "https:", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 14,
  });
  return response;
}
