import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  exchangeGoogleOAuthCode,
  saveGoogleDriveConnection,
  verifyGoogleOAuthState,
} from "@/lib/google-drive";
import { isAdmin } from "@/lib/security";

const STATE_COOKIE = "snap_hub_google_oauth_state";

function finish(request: Request, status: string) {
  const response = NextResponse.redirect(new URL(`/admin?drive=${encodeURIComponent(status)}`, request.url), 303);
  response.cookies.set(STATE_COOKIE, "", {
    httpOnly: true,
    secure: new URL(request.url).protocol === "https:",
    sameSite: "lax",
    path: "/api/admin/google-drive/callback",
    maxAge: 0,
  });
  return response;
}

export async function GET(request: Request) {
  if (!(await isAdmin())) return NextResponse.redirect(new URL("/", request.url), 303);
  const url = new URL(request.url);
  const state = url.searchParams.get("state") ?? "";
  const jar = await cookies();
  const cookieState = jar.get(STATE_COOKIE)?.value;
  if (!cookieState || cookieState !== state || !(await verifyGoogleOAuthState(state))) return finish(request, "invalid-state");
  if (url.searchParams.get("error")) return finish(request, "cancelled");
  const code = url.searchParams.get("code");
  if (!code) return finish(request, "missing-code");
  try {
    const authorization = await exchangeGoogleOAuthCode(code, url.origin);
    await saveGoogleDriveConnection(authorization.refreshToken, authorization.accessToken, authorization.email);
    return finish(request, "connected");
  } catch {
    return finish(request, "failed");
  }
}
