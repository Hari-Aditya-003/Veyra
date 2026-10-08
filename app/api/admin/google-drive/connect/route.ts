import { NextResponse } from "next/server";
import { createGoogleOAuthState, googleDriveConfigured, googleOAuthAuthorizationUrl } from "@/lib/google-drive";
import { isAdmin } from "@/lib/security";

const STATE_COOKIE = "snap_hub_google_oauth_state";

export async function GET(request: Request) {
  if (!(await isAdmin())) return NextResponse.redirect(new URL("/", request.url), 303);
  if (!googleDriveConfigured()) return NextResponse.redirect(new URL("/admin?drive=not-configured", request.url), 303);
  const state = await createGoogleOAuthState();
  const response = NextResponse.redirect(googleOAuthAuthorizationUrl(new URL(request.url).origin, state), 303);
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: new URL(request.url).protocol === "https:",
    sameSite: "lax",
    path: "/api/admin/google-drive/callback",
    maxAge: 10 * 60,
  });
  return response;
}
