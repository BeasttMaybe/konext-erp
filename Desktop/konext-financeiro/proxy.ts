import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Next.js 16: proxy.ts roda no Node.js runtime por padrão (não Edge Runtime).
// Isso elimina completamente o erro "__dirname is not defined" que ocorria no
// Edge Runtime do middleware.ts (convenção deprecated do Next.js 13-15).

export function proxy(request: NextRequest) {
  const session = request.cookies.get("konext_session")?.value;
  const { pathname } = request.nextUrl;

  const rotaLogin = pathname === "/login";
  const rotaApi = pathname.startsWith("/api/");

  // Proteção de arquivos estáticos internos do Next
  if (pathname.startsWith("/_next") || pathname.includes(".")) {
    return NextResponse.next();
  }

  // Se não tem sessão e não está no login, manda para o login
  if (!session && !rotaLogin && !rotaApi) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Se já tem sessão e tenta ir para o login, manda para a home
  if (session && rotaLogin) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
