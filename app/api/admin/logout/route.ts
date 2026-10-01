import { NextResponse } from "next/server";
import { adminCookieName } from "@/lib/security";

export async function POST(request: Request) {
  const response = NextResponse.redirect(new URL("/", request.url), 303);
  response.cookies.set(adminCookieName(), "", { path: "/", maxAge: 0 });
  return response;
}
