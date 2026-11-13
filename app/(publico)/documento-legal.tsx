import Link from "next/link";

import type { SecaoLegal } from "@/lib/legal/documentos";
import { VIGENTE_DESDE } from "@/lib/legal/documentos";

export function DocumentoLegal({ titulo, secoes }: { titulo: string; secoes: SecaoLegal[] }) {
  return (
    <main className="min-h-screen w-full px-4 py-10 sm:px-6" style={{ backgroundColor: "var(--kx-fundo)", color: "var(--kx-texto)" }}>
      <article className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <header className="flex flex-col gap-2">
          <Link href="/login" className="text-sm font-semibold" style={{ color: "var(--kx-link)" }}>
            ← TechOS ERP
          </Link>
          <h1 className="text-3xl font-extrabold tracking-tight">{titulo}</h1>
          <p className="text-sm" style={{ color: "var(--kx-legenda)" }}>
            Versão vigente desde {VIGENTE_DESDE}.
          </p>
        </header>
        {secoes.map((secao) => (
          <section key={secao.titulo} className="flex flex-col gap-2">
            <h2 className="text-lg font-bold">{secao.titulo}</h2>
            {secao.paragrafos.map((paragrafo) => (
              <p key={paragrafo} className="text-[15px] leading-relaxed" style={{ color: "var(--kx-texto-2)" }}>
                {paragrafo}
              </p>
            ))}
          </section>
        ))}
        <footer className="border-t pt-4 text-sm" style={{ borderColor: "var(--kx-painel-borda)", color: "var(--kx-legenda)" }}>
          <Link href="/termos" style={{ color: "var(--kx-link)" }}>
            Termos de Uso
          </Link>{" "}
          ·{" "}
          <Link href="/privacidade" style={{ color: "var(--kx-link)" }}>
            Política de Privacidade
          </Link>
        </footer>
      </article>
    </main>
  );
}
