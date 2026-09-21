import { ShieldCheck, ShieldAlert } from "lucide-react";
import { obterPreviaTermoGarantiaOS } from "@/app/actions/garantias";
import { exigirContextoTenant } from "@/lib/tenant/exigir-contexto-tenant";
import { agoraNaLoja, FUSO_HORARIO_PADRAO, somarDias } from "@/lib/datas";

type AcaoGarantiaOSProps = {
  osId: string;
  statusOS: string;
  possuiTermoGarantia: boolean;
  possuiItens?: boolean;
  mostrarTextoBloqueio?: boolean;
};

function formatarData(data: Date, fusoHorario: string): string {
  return data.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: fusoHorario,
  });
}

/**
 * Painel informativo da garantia de uma OS ainda nao entregue.
 *
 * Ate a Fase 1A este componente tinha um botao "Gerar garantia" que emitia o
 * termo com a OS ainda em PRONTO, ancorando `dataInicioGarantia` em
 * `atualizadoEm` — a garantia do cliente comecava a correr no ultimo arraste do
 * cartao no Kanban, antes de ele receber o aparelho (AUDIT_REPORT 16.7-a).
 *
 * Agora o termo nasce exclusivamente na finalizacao da OS, ancorado na entrega.
 * O que se mostra aqui e uma PREVIA calculada, nunca persistida.
 */
export async function AcaoGarantiaOS({
  osId,
  statusOS,
  possuiTermoGarantia,
  possuiItens = true,
}: AcaoGarantiaOSProps) {
  if (possuiTermoGarantia || statusOS === "ENTREGUE") {
    return null;
  }

  const previa = await obterPreviaTermoGarantiaOS(osId);

  if (!previa) {
    return null;
  }

  let fusoHorario = FUSO_HORARIO_PADRAO;
  try {
    fusoHorario = (await exigirContextoTenant()).fusoHorario ?? FUSO_HORARIO_PADRAO;
  } catch {
    // Sem contexto: cai no fuso padrao — nunca quebra a previa por isso.
  }

  const faltamItens = previa.exigeItemParaGarantia && !possuiItens;
  const terminoPrevisto = somarDias(agoraNaLoja(fusoHorario), previa.prazoPrevistoDias, fusoHorario);

  return (
    <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm">
      <div className="flex items-start gap-3">
        {faltamItens ? (
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden />
        ) : (
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
        )}

        <div className="space-y-1">
          <p className="font-medium text-foreground">
            A garantia será emitida na entrega da OS.
          </p>

          {faltamItens ? (
            <p className="text-amber-700 dark:text-amber-400">
              Cadastre ao menos uma peça ou serviço na OS: sem itens, a garantia não pode ser gerada
              na finalização.
            </p>
          ) : (
            <p className="text-muted-foreground">
              Prévia: {previa.prazoPrevistoDias} dias de garantia. Se a OS fosse entregue hoje, a
              cobertura iria até {formatarData(terminoPrevisto, fusoHorario)}. A contagem só começa na entrega
              real.
            </p>
          )}

          <p className="text-xs text-muted-foreground">
            Prazo configurado entre {previa.prazoMinimoDias} e {previa.prazoMaximoDias} dias —
            ajustável no momento de finalizar.
          </p>
        </div>
      </div>
    </div>
  );
}
