import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { COOKIE_SESSAO_CENTRAL, COOKIE_SESSAO_LEGADA } from "@/lib/auth/cookies";
import { rotaPermitidaParaTenantMigrado } from "@/lib/tenant/rotas-migradas";

export function middleware(request: NextRequest) {
  const sessaoLegada = request.cookies.get(COOKIE_SESSAO_LEGADA)?.value;
  const sessaoCentral = request.cookies.get(COOKIE_SESSAO_CENTRAL)?.value;
  const { pathname } = request.nextUrl;

  const rotaLogin = pathname === "/login";
  const rotaApi = pathname.startsWith("/api/");

  if (pathname.startsWith("/_next") || pathname.includes(".")) {
    return NextResponse.next();
  }

  if (!sessaoLegada && !sessaoCentral && !rotaLogin && !rotaApi) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if ((sessaoLegada || sessaoCentral) && rotaLogin) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (!sessaoLegada && sessaoCentral) {
    if (pathname === "/") {
      return NextResponse.redirect(new URL("/inicio", request.url));
    }

    if (!rotaLogin && !rotaApi && !rotaPermitidaParaTenantMigrado(pathname)) {
      return NextResponse.redirect(new URL("/inicio", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
