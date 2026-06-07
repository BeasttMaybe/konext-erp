import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Middleware — 100% compatível com Edge Runtime.
 * Regra simples: verifica APENAS a presença do cookie de sessão.
 * Nenhum import de Prisma, bcrypt ou módulos Node.js é feito aqui.
 * Toda validação real de sessão ocorre dentro das Server Actions.
 */
export function middleware(request: NextRequest) {
  const session = request.cookies.get("konext_session")?.value;
  const { pathname } = request.nextUrl;

  const rotaLogin = pathname === "/login";
  const rotaApi = pathname.startsWith("/api/");
  const rotaPublica = rotaLogin || rotaApi;

  if (!session && !rotaPublica) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (session && rotaLogin) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.ico$).*)"],
};
