import type { ComponentType } from "react";
import { AlertTriangle, Banknote, BellRing, CalendarClock, Clock, Trophy, Wallet } from "lucide-react";

import type { CaixaPrefeitura } from "@/app/actions/prefeitura";
import { GraficoRecebimentos } from "@/components/prefeitura/grafico-recebimentos";
import { formatarReais } from "@/lib/dinheiro";

const data = (iso: string) =>
  iso ? new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const pct0 = (v: number | null) => (v === null ? "—" : `${Math.round(v)}%`);

function Kpi({
  rotulo,
  valor,
  nota,
  icone: Icone,
  corValor = "text-kx-texto",
}: {
  rotulo: string;
  valor: string;
  nota?: string;
  icone: ComponentType<{ className?: string }>;
  corValor?: string;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-kx-painel border border-kx-painel-borda bg-kx-painel p-4">
      <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-kx-legenda">
        <Icone className="h-3.5 w-3.5" /> {rotulo}
      </span>
      <span className={`text-2xl font-extrabold ${corValor}`}>{valor}</span>
      {nota ? <span className="text-xs text-kx-legenda">{nota}</span> : null}
    </div>
  );
}

export function CaixaBloco({ caixa }: { caixa: CaixaPrefeitura }) {
  if (!caixa.temDados) {
    return (
      <p className="rounded-kx-painel border border-kx-painel-borda bg-kx-painel px-4 py-10 text-center text-sm text-kx-legenda">
        Ainda não há contas a receber da prefeitura. Elas aparecem conforme o Bling é sincronizado (Financeiro → Notas Fiscais).
      </p>
    );
  }

  const prazo =
    caixa.prazoMedioDias === null
      ? "—"
      : caixa.prazoMedioDias === 0
        ? "no prazo"
        : caixa.prazoMedioDias > 0
          ? `+${caixa.prazoMedioDias} dias`
          : `${caixa.prazoMedioDias} dias`;

  const { vencidasQtd, vencidasCentavos, vencendoQtd, vencendoCentavos, vencendoDias } = caixa.alertas;

  return (
    <div className="flex flex-col gap-3">
      {vencidasQtd > 0 || vencendoQtd > 0 ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          {vencidasQtd > 0 ? (
            <div className="flex flex-1 items-center gap-2.5 rounded-kx-botao border border-kx-erro-borda bg-kx-erro-fundo px-4 py-2.5">
              <AlertTriangle className="h-4 w-4 shrink-0 text-kx-erro-texto" aria-hidden />
              <span className="text-sm text-kx-erro-texto">
                <span className="font-bold">
                  {vencidasQtd} conta(s) vencida(s) · {formatarReais(vencidasCentavos)}
                </span>{" "}
                aguardando pagamento.
              </span>
            </div>
          ) : null}
          {vencendoQtd > 0 ? (
            <div className="flex flex-1 items-center gap-2.5 rounded-kx-botao bg-kx-alerta-fundo px-4 py-2.5">
              <BellRing className="h-4 w-4 shrink-0 text-kx-alerta-texto" aria-hidden />
              <span className="text-sm text-kx-alerta-texto">
                <span className="font-bold">
                  {vencendoQtd} vencendo em {vencendoDias} dias · {formatarReais(vencendoCentavos)}
                </span>
                .
              </span>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 xl:grid-cols-5">
        <Kpi rotulo="A receber" valor={formatarReais(caixa.aReceberAbertoCentavos)} nota={`${caixa.qtdAberto} em aberto`} icone={Wallet} />
        <Kpi
          rotulo="Vencido"
          valor={formatarReais(caixa.vencidoCentavos)}
          nota={`${caixa.qtdVencido} atrasada(s)`}
          icone={AlertTriangle}
          corValor={caixa.vencidoCentavos > 0 ? "text-kx-erro-texto" : "text-kx-texto"}
        />
        <Kpi rotulo="A vencer" valor={formatarReais(caixa.aVencerCentavos)} icone={CalendarClock} />
        <Kpi rotulo="Recebido" valor={formatarReais(caixa.recebidoCentavos)} icone={Banknote} corValor="text-kx-sucesso-texto" />
        <Kpi rotulo="Prazo médio" valor={prazo} nota="após o vencimento" icone={Clock} />
      </div>

      <GraficoRecebimentos dados={caixa.recebimentosPorMes} />

      {caixa.contasAbertas.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-bold uppercase tracking-wide text-kx-legenda">Em aberto (mais urgentes)</span>
          <ul className="flex flex-col divide-y divide-kx-painel-borda overflow-hidden rounded-kx-botao border border-kx-painel-borda">
            {caixa.contasAbertas.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 bg-kx-superficie px-4 py-2.5">
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm text-kx-texto">{c.prefeitura ?? c.descricao}</span>
                  <span className="text-xs text-kx-legenda">
                    Vence {data(c.vencimento)}
                    {c.atrasoDias > 0 ? <span className="text-kx-erro-texto"> · {c.atrasoDias} dia(s) de atraso</span> : null}
                  </span>
                </div>
                <span className={`shrink-0 text-sm font-bold ${c.atrasoDias > 0 ? "text-kx-erro-texto" : "text-kx-texto"}`}>
                  {formatarReais(c.valorCentavos)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {caixa.ranking.length > 0 ? (
        <div className="flex flex-col gap-2 rounded-kx-painel border border-kx-painel-borda bg-kx-painel p-4">
          <div className="flex flex-col gap-0.5">
            <span className="flex items-center gap-1.5 text-sm font-bold text-kx-texto">
              <Trophy className="h-4 w-4" aria-hidden /> Prefeituras que mais renderam
            </span>
            <span className="text-xs text-kx-legenda">Por dinheiro já recebido (todas as prefeituras, desde sempre).</span>
          </div>
          <ol className="flex flex-col gap-2">
            {caixa.ranking.map((p, i) => {
              const total = p.recebidoCentavos + p.aReceberCentavos;
              const larguraRecebido = total > 0 ? Math.max(2, Math.round((p.recebidoCentavos / total) * 100)) : 0;
              return (
                <li key={p.nome} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-2 text-sm text-kx-texto">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-kx-superficie text-[11px] font-bold text-kx-texto-2">
                        {i + 1}
                      </span>
                      <span className="truncate font-bold">{p.nome}</span>
                    </span>
                    <span className="shrink-0 text-sm font-bold text-kx-sucesso-texto">{formatarReais(p.recebidoCentavos)}</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-kx-superficie">
                    <div className="h-full rounded-full bg-kx-sucesso-texto" style={{ width: `${larguraRecebido}%` }} />
                  </div>
                  <span className="text-[11px] text-kx-legenda">
                    {pct0(p.percentualRecebido)} recebido
                    {p.aReceberCentavos > 0 ? ` · ${formatarReais(p.aReceberCentavos)} a receber` : ""}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      ) : null}
    </div>
  );
}
