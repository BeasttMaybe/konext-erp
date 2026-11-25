import type { ComponentType } from "react";
import { AlertTriangle, Banknote, CalendarClock, Clock, Wallet } from "lucide-react";

import type { CaixaPrefeitura } from "@/app/actions/prefeitura";
import { formatarReais } from "@/lib/dinheiro";

const data = (iso: string) =>
  iso ? new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }) : "—";

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

  return (
    <div className="flex flex-col gap-3">
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

      {caixa.contasAbertas.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-bold uppercase tracking-wide text-kx-legenda">Em aberto (mais urgentes)</span>
          <ul className="flex flex-col divide-y divide-kx-painel-borda overflow-hidden rounded-kx-botao border border-kx-painel-borda">
            {caixa.contasAbertas.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 bg-kx-superficie px-4 py-2.5">
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm text-kx-texto">{c.descricao}</span>
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
    </div>
  );
}
