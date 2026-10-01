import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { adminCookieName, createAdminSession } from "@/lib/security";

export async function POST(request: Request) {
  const form = await request.formData();
  const username = String(form.get("username") ?? "");
  const password = String(form.get("password") ?? "");
  const base = new URL(request.url);

  if (username !== env.ADMIN_USERNAME || password !== env.ADMIN_PASSWORD) {
    return NextResponse.redirect(new URL("/?error=invalid-login", base), 303);
  }

  const response = NextResponse.redirect(new URL("/admin", base), 303);
  response.cookies.set(adminCookieName(), await createAdminSession(), {
    httpOnly: true,
    secure: base.protocol === "https:",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return response;
}
