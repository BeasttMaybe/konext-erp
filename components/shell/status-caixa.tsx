"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { obterResumoCaixaAbertoAtual, verificarStatusCaixa, type ResumoCaixaAbertoAtual } from "@/app/actions/caixa-pdv";

type Estado =
  | { tela: "carregando" }
  | { tela: "sem-permissao" }
  | { tela: "fechado" }
  | { tela: "aberto"; resumo: ResumoCaixaAbertoAtual };

function formatarMoeda(valor: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor);
}

/**
 * Bloco de status do caixa no rodapé da barra lateral (Fase 3-1, Parte 3).
 * `verificarStatusCaixa`/`obterResumoCaixaAbertoAtual` (app/actions/caixa-pdv.ts)
 * são de escopo do TENANT inteiro, não por usuário — não existe hoje uma
 * versão "meu caixa está aberto" (documentado no relatório final da fase).
 * Some inteiro pra quem não tem pdv.vender — nunca mostra desabilitado.
 *
 * `expandido` é uma prop explícita, não `xl:` do Tailwind: este componente
 * também é usado dentro da gaveta mobile (`GavetaLateralMobile`), que
 * renderiza larga mesmo em viewport pequeno — uma media query de viewport
 * erraria lá (o breakpoint xl nunca bate num celular, mesmo com a gaveta
 * aberta e larga).
 */
export function StatusCaixa({ expandido = true }: { expandido?: boolean }) {
  const [estado, setEstado] = useState<Estado>({ tela: "carregando" });

  useEffect(() => {
    verificarStatusCaixa()
      .then((aberto) => {
        if (!aberto) {
          setEstado({ tela: "fechado" });
          return;
        }
        obterResumoCaixaAbertoAtual()
          .then((resumo) => setEstado({ tela: "aberto", resumo }))
          .catch(() => setEstado({ tela: "fechado" }));
      })
      .catch(() => setEstado({ tela: "sem-permissao" }));
  }, []);

  if (estado.tela === "carregando" || estado.tela === "sem-permissao") {
    return null;
  }

  const aberto = estado.tela === "aberto";
  const rotulo = aberto ? "Caixa aberto" : "Caixa fechado";

  if (!expandido) {
    return (
      <Link
        href="/pdv"
        title={rotulo}
        className="flex h-11 items-center justify-center rounded-kx-botao text-kx-texto-2 hover:bg-kx-superficie"
      >
        <span className={cn("h-2.5 w-2.5 rounded-full", aberto ? "bg-kx-sucesso" : "bg-kx-legenda")} aria-hidden="true" />
        <span className="sr-only">{rotulo}</span>
      </Link>
    );
  }

  return (
    <Link
      href="/pdv"
      className="flex items-center gap-2.5 rounded-kx-botao bg-kx-superficie px-3 py-2.5 text-xs transition-colors hover:bg-kx-cartao"
    >
      <Wallet className="h-4 w-4 shrink-0 text-kx-texto-2" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", aberto ? "bg-kx-sucesso" : "bg-kx-legenda")} />
          <span className="font-medium text-kx-texto">{rotulo}</span>
        </span>
        {aberto && estado.tela === "aberto" && (
          <span className="block tabular-nums text-kx-legenda">
            {formatarMoeda(estado.resumo.valorSugeridoFechamento)}
          </span>
        )}
      </span>
    </Link>
  );
}
