import { CircleAlert, ShieldAlert, ShieldCheck } from "lucide-react";

import type { EstadoDoSistema as Estado } from "@/lib/sistema/estado";
import type { ErroRecente } from "@/lib/sistema/registrar-erro";
import { MODULOS, type IdModulo } from "@/lib/modulos/catalogo";
import { FUSO_HORARIO_PADRAO } from "@/lib/datas";

function quando(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: FUSO_HORARIO_PADRAO,
  });
}

const ROTULO_DO_AMBIENTE: Record<string, string> = {
  production: "produção",
  preview: "prévia",
  development: "desenvolvimento",
};

/**
 * Faixa no pe das Configuracoes: qual versao esta no ar e se as rotinas
 * automaticas estao protegidas.
 *
 * Componente de servidor de proposito — ele le variaveis de ambiente (pelo
 * `lerEstadoDoSistema`, chamado na pagina) e nada disso precisa ir para o
 * navegador alem do texto pronto.
 *
 * O aviso das rotinas NAO e decorativo: sem `CRON_SECRET`, em producao as
 * tres rotinas se recusam a rodar. Se isso acontecer, o dono precisa saber
 * olhando para a tela, e nao descobrir semanas depois que o caixa nao fecha
 * mais sozinho.
 */
export function EstadoDoSistema({
  estado,
  erros,
  modulosAtivos,
}: {
  estado: Estado;
  erros?: { total24h: number; ultimos: ErroRecente[] } | null;
  /** Modulos contratados (lib/modulos/catalogo.ts); ausente = nao mostra. */
  modulosAtivos?: readonly IdModulo[];
}) {
  const ambiente = estado.ambiente ? (ROTULO_DO_AMBIENTE[estado.ambiente] ?? estado.ambiente) : null;

  return (
    <section
      aria-label="Estado do sistema"
      className="mt-5 flex flex-col gap-3 rounded-kx-painel border border-kx-painel-borda bg-kx-superficie px-4 py-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <p className="text-xs text-kx-legenda">
          Versão no ar:{" "}
          <span className="font-mono font-semibold text-kx-texto">
            {estado.versao ?? "não identificada"}
          </span>
          {ambiente ? ` · ${ambiente}` : null}
          {estado.ramo ? ` · ${estado.ramo}` : null}
        </p>

        {erros ? (
          <p className="flex items-center gap-1.5 text-xs text-kx-legenda">
            {erros.total24h === 0 ? (
              <ShieldCheck className="h-4 w-4 text-kx-sucesso-texto" aria-hidden />
            ) : (
              <CircleAlert className="h-4 w-4 text-kx-alerta-texto" aria-hidden />
            )}
            {erros.total24h === 0
              ? "Nenhum erro nas últimas 24 h"
              : `${erros.total24h} ${erros.total24h === 1 ? "erro" : "erros"} nas últimas 24 h`}
          </p>
        ) : null}

        {estado.rotinasProtegidas ? (
          <p className="flex items-center gap-1.5 text-xs text-kx-legenda">
            <ShieldCheck className="h-4 w-4 text-kx-sucesso-texto" aria-hidden />
            Rotinas automáticas protegidas
          </p>
        ) : null}
      </div>

      {modulosAtivos ? (
        <div className="flex flex-col gap-1.5 text-xs text-kx-legenda">
          <span className="font-semibold text-kx-texto-2">
            Módulos do seu plano ({MODULOS.filter((m) => modulosAtivos.includes(m.id)).length} de {MODULOS.length})
          </span>
          <ul className="flex flex-wrap gap-1.5" aria-label="Módulos do plano">
            {MODULOS.map((modulo) => {
              const ativo = modulosAtivos.includes(modulo.id);
              return (
                <li
                  key={modulo.id}
                  className={`rounded-full border px-2.5 py-0.5 ${
                    ativo ? "border-kx-painel-borda bg-kx-painel text-kx-texto" : "border-dashed border-kx-campo-borda text-kx-legenda line-through"
                  }`}
                  title={ativo ? modulo.descricao : `${modulo.nome}: não contratado`}
                >
                  {modulo.nome}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {erros && erros.ultimos.length > 0 ? (
        <details className="text-xs text-kx-legenda">
          <summary className="cursor-pointer font-semibold text-kx-texto-2">Últimos erros registrados</summary>
          <p className="mt-2">
            O sistema registra sozinho cada erro que acontece nas telas da sua loja. Se um deles se repetir, mande um
            print desta lista para o suporte.
          </p>
          <ul className="mt-2 flex flex-col gap-1.5">
            {erros.ultimos.map((erro) => (
              <li key={erro.id} className="rounded-kx-botao border border-kx-painel-borda bg-kx-painel px-3 py-2">
                <span className="font-semibold text-kx-texto">{quando(erro.criadoEm)}</span> · {erro.origem}
                <span className="mt-0.5 block break-words font-mono text-[11px]">{erro.mensagem}</span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {estado.rotinasProtegidas ? null : (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-kx-painel border border-kx-alerta bg-kx-alerta-fundo px-3 py-2.5 text-sm text-kx-alerta-texto"
        >
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>
            <strong>As rotinas automáticas estão paradas.</strong> O fechamento automático do caixa, os
            avisos de vencimento e a atualização das metas só rodam quando existe a variável{" "}
            <code className="font-mono">CRON_SECRET</code> na hospedagem — sem ela, qualquer pessoa na
            internet poderia dispará-las, então o sistema se recusa. Crie a variável na Vercel
            (Settings → Environment Variables), com um valor longo e aleatório, e publique de novo.
          </p>
        </div>
      )}
    </section>
  );
}
