import Link from "next/link";
import type { PeriodoDashboard } from "@/app/actions/dashboard";
import { agoraNaLoja, FUSO_HORARIO_PADRAO } from "@/lib/datas";
import { FiltroPeriodoPagina } from "@/components/ui/filtro-periodo-pagina";
import { cn } from "@/lib/utils";

const OPCOES_PERIODO: Array<{ valor: PeriodoDashboard; rotulo: string }> = [
  { valor: "hoje", rotulo: "Hoje" },
  { valor: "7d", rotulo: "7 dias" },
  { valor: "30d", rotulo: "30 dias" },
  { valor: "mes", rotulo: "Mês" },
];

type CabecalhoDashboardProps = {
  empresa: string;
  periodo: PeriodoDashboard;
  /** Fuso horário da loja (Fase 2A-1) — vem de `contexto.fusoHorario`. */
  fusoHorario?: string;
};

/** Cabeçalho da home (Fase 3-2A): nome da empresa, data e seletor de período. */
export function CabecalhoDashboard({ empresa, periodo, fusoHorario }: CabecalhoDashboardProps) {
  // Componente de servidor: sem isto, "hoje" seria calculado no fuso do
  // processo (Vercel roda em UTC), mostrando a data errada entre 21h e
  // 23:59 no horário da loja. Ver lib/datas.ts.
  const dataHoje = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: fusoHorario ?? FUSO_HORARIO_PADRAO,
  }).format(agoraNaLoja(fusoHorario));

  return (
    <div className="flex flex-wrap items-center justify-between gap-kx-3">
      <div>
        <h1 className="text-lg font-semibold text-kx-texto">{empresa}</h1>
        <p className="text-sm text-kx-legenda">{dataHoje}</p>
      </div>

      {/* No celular os cinco periodos nao cabem numa linha: a barra rola de
          lado por dentro, sem empurrar a pagina. */}
      <nav aria-label="Período" className="flex max-w-full items-center gap-1 overflow-x-auto rounded-kx-botao bg-kx-superficie p-1">
        {OPCOES_PERIODO.map((opcao) => {
          const ativo = opcao.valor === periodo;

          return (
            <Link
              key={opcao.valor}
              href={`/?periodo=${opcao.valor}`}
              aria-current={ativo ? "page" : undefined}
              className={cn(
                "flex h-11 shrink-0 items-center whitespace-nowrap rounded-kx-botao px-3 text-sm font-medium transition-colors",
                ativo ? "bg-kx-primaria/15 text-kx-destaque" : "text-kx-legenda hover:text-kx-texto"
              )}
            >
              {opcao.rotulo}
            </Link>
          );
        })}

        {/*
          "Personalizado" (Fase 2A-1): abre o FiltroPeriodo sem seletor de
          campo (a home tem um único período, não múltiplos campos de
          data). paramsAdicionais grava periodo=custom na MESMA navegação
          que inicio/fim, pra "Personalizado" ficar destacado (aria-current)
          já no primeiro carregamento depois de filtrar — sem isso a pill
          ficaria "apagada" mesmo com um período customizado ativo.

          Fase 2A-1 follow-up ("adoção idêntica ao Dashboard"): passa a
          usar `FiltroPeriodoPagina` — o mesmo wrapper que as outras 6
          telas usam agora — em vez de montar `FiltroPeriodo` direto com
          sua própria configuração solta. `variante="pill"` é a única
          diferença visual permitida (o chip transparente que se integra à
          barra de navegação de período, em vez do botão contornado avulso
          das outras telas) — nunca uma prop de layout/tamanho do painel,
          que continua 100% fixo dentro de `FiltroPeriodo`.
        */}
        <FiltroPeriodoPagina
          campos={[{ valor: "personalizado", rotulo: "Personalizado" }]}
          fusoHorario={fusoHorario}
          paramsAdicionais={{ periodo: "custom" }}
          variante="pill"
          ativo={periodo === "custom"}
        />
      </nav>
    </div>
  );
}
