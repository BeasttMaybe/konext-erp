import { ShieldAlert, ShieldCheck } from "lucide-react";

import type { EstadoDoSistema as Estado } from "@/lib/sistema/estado";

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
export function EstadoDoSistema({ estado }: { estado: Estado }) {
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

        {estado.rotinasProtegidas ? (
          <p className="flex items-center gap-1.5 text-xs text-kx-legenda">
            <ShieldCheck className="h-4 w-4 text-kx-sucesso-texto" aria-hidden />
            Rotinas automáticas protegidas
          </p>
        ) : null}
      </div>

      {estado.rotinasProtegidas ? null : (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-kx-painel border border-kx-alerta-borda bg-kx-alerta-fundo px-3 py-2.5 text-sm text-kx-alerta-texto"
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
