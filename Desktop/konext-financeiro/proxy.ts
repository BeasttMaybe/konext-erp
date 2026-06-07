import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const session = request.cookies.get("konext_session")?.value;
  const { pathname } = request.nextUrl;

  const rotaLogin = pathname === "/login";
  const rotaApi = pathname.startsWith("/api/");

  if (!session && !rotaLogin && !rotaApi) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (session && rotaLogin) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};