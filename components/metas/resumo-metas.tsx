import { AlertTriangle, CheckCircle2, Clock, WifiOff } from "lucide-react";

import type { DashboardMetasResult } from "@/app/actions/metas";

function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/**
 * Resumo das metas, numa faixa só.
 *
 * Substitui onze cartões de KPI: "Total de metas", "Metas manuais", "Metas
 * automáticas", "Pausadas", "Em atenção", "Concluídas"... Metade daquilo era
 * detalhe interno — se uma meta é manual ou automática é jeito de alimentar o
 * número, não decisão de ninguém — e o resto era contagem que a própria lista
 * logo abaixo já mostrava.
 *
 * Ficaram quatro coisas, e cada uma existe por uma pergunta:
 *
 * - sincronização quebrada: o número na tela é confiável?
 * - atrasadas: o que preciso resolver?
 * - em andamento: quanto está em jogo?
 * - financeiro: quanto do dinheiro planejado já veio?
 *
 * Os dois primeiros só aparecem quando há o que mostrar. Um cartão escrito
 * "Atrasadas: 0" ocupa o mesmo espaço do que diz "Atrasadas: 3" e treina quem
 * olha a ignorar a área inteira.
 */
export function ResumoMetas({ dados }: { dados: DashboardMetasResult }) {
  const precisamAtencao = dados.atrasadas + dados.emAtencao;

  const percentualFinanceiro =
    dados.valorTotalPlanejado > 0
      ? Math.min(100, (dados.valorAlcancado / dados.valorTotalPlanejado) * 100)
      : null;

  return (
    <div className="flex flex-col gap-3">
      {dados.automaticasComErroSincronizacao > 0 && (
        <div className="flex items-start gap-2.5 rounded-kx-cartao border border-kx-erro-borda bg-kx-erro-fundo px-4 py-3">
          <WifiOff className="mt-0.5 h-4 w-4 shrink-0 text-kx-erro-icone" aria-hidden />
          <div>
            <p className="text-sm font-bold text-kx-erro-texto">
              {dados.automaticasComErroSincronizacao}{" "}
              {dados.automaticasComErroSincronizacao === 1
                ? "meta não conseguiu atualizar"
                : "metas não conseguiram atualizar"}
            </p>
            <p className="text-xs text-kx-erro-texto">
              O número que aparece nelas é o da última atualização que deu certo, não o de hoje.
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-stretch gap-3">
        {precisamAtencao > 0 && (
          <Bloco
            icone={AlertTriangle}
            classeIcone="text-kx-alerta-icone"
            classeBloco="border-kx-alerta bg-kx-alerta-fundo"
            valor={String(precisamAtencao)}
            rotulo={precisamAtencao === 1 ? "meta precisa de atenção" : "metas precisam de atenção"}
            detalhe={
              dados.atrasadas > 0
                ? `${dados.atrasadas} ${dados.atrasadas === 1 ? "atrasada" : "atrasadas"}`
                : undefined
            }
          />
        )}

        <Bloco
          icone={Clock}
          classeIcone="text-kx-info-icone"
          classeBloco="border-kx-painel-borda bg-kx-cartao"
          valor={String(dados.emAndamento)}
          rotulo={dados.emAndamento === 1 ? "meta em andamento" : "metas em andamento"}
        />

        <Bloco
          icone={CheckCircle2}
          classeIcone="text-kx-sucesso-icone"
          classeBloco="border-kx-painel-borda bg-kx-cartao"
          valor={String(dados.concluidas)}
          rotulo={dados.concluidas === 1 ? "meta concluída" : "metas concluídas"}
        />

        {percentualFinanceiro !== null && (
          <div className="flex min-w-[260px] flex-1 flex-col justify-center rounded-kx-cartao border border-kx-painel-borda bg-kx-cartao px-4 py-3">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-kx-legenda">
                Metas financeiras
              </p>
              <p className="text-sm font-bold tabular-nums text-kx-texto">
                {percentualFinanceiro.toFixed(0)}%
              </p>
            </div>

            <div
              className="mt-2 h-2 overflow-hidden rounded-kx-pilula bg-kx-superficie"
              role="progressbar"
              aria-valuenow={Math.round(percentualFinanceiro)}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="h-full rounded-kx-pilula bg-kx-sucesso"
                style={{ width: `${percentualFinanceiro}%` }}
              />
            </div>

            <p className="mt-1.5 text-xs text-kx-legenda tabular-nums">
              {formatarMoeda(dados.valorAlcancado)} de {formatarMoeda(dados.valorTotalPlanejado)}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function Bloco({
  icone: Icone,
  classeIcone,
  classeBloco,
  valor,
  rotulo,
  detalhe,
}: {
  icone: typeof AlertTriangle;
  classeIcone: string;
  classeBloco: string;
  valor: string;
  rotulo: string;
  detalhe?: string;
}) {
  return (
    <div className={`flex items-center gap-3 rounded-kx-cartao border px-4 py-3 ${classeBloco}`}>
      <Icone className={`h-5 w-5 shrink-0 ${classeIcone}`} aria-hidden />
      <div>
        <p className="text-xl font-bold leading-none tabular-nums text-kx-texto">{valor}</p>
        <p className="mt-1 text-xs text-kx-legenda">{rotulo}</p>
        {detalhe && <p className="text-xs font-semibold text-kx-alerta-texto">{detalhe}</p>}
      </div>
    </div>
  );
}
