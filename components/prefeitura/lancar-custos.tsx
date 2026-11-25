"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";

import { salvarCustosDaNota, type NotaPrefeituraDetalhe } from "@/app/actions/prefeitura";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatarReais, lerEntradaMonetaria } from "@/lib/dinheiro";
import { cn } from "@/lib/utils";

// Usa o leitor oficial do projeto (entende "1.234,56", "40", "40,5"). Vazio -> null.
const paraCentavos = (texto: string): number | null => lerEntradaMonetaria(texto);

const centavosParaCampo = (c: number | null): string => (c === null ? "" : (c / 100).toFixed(2).replace(".", ","));

export function LancarCustos({ nota }: { nota: NotaPrefeituraDetalhe }) {
  const router = useRouter();
  const [modo, setModo] = useState<"ITENS" | "TOTAL">(nota.modoCusto);
  const [custoTotal, setCustoTotal] = useState<string>(centavosParaCampo(nota.custoTotalInformadoCentavos));
  const [custos, setCustos] = useState<Record<string, string>>(() =>
    Object.fromEntries(nota.itens.map((i) => [i.id, centavosParaCampo(i.custoCentavos)]))
  );
  const [salvando, setSalvando] = useState(false);

  // Prévia do lucro conforme o modo e o que foi digitado.
  const previa = useMemo(() => {
    const receita = nota.receitaCentavos;
    if (modo === "TOTAL") {
      const custo = paraCentavos(custoTotal);
      return custo === null ? null : { custo, lucro: receita - custo };
    }
    let custo = 0;
    let completo = true;
    for (const item of nota.itens) {
      const c = paraCentavos(custos[item.id] ?? "");
      if (c === null) completo = false;
      else custo += c;
    }
    return completo && nota.itens.length > 0 ? { custo, lucro: receita - custo } : null;
  }, [modo, custoTotal, custos, nota]);

  const salvar = async () => {
    setSalvando(true);
    try {
      const r = await salvarCustosDaNota({
        notaId: nota.id,
        modoCusto: modo,
        custoTotalCentavos: modo === "TOTAL" ? paraCentavos(custoTotal) : null,
        itens: nota.itens.map((i) => ({ id: i.id, custoCentavos: paraCentavos(custos[i.id] ?? "") })),
      });
      if (r.ok) {
        toast.success("Custos salvos.");
        router.refresh();
      } else {
        toast.error(r.erro ?? "Não foi possível salvar.");
      }
    } catch {
      toast.error("Não foi possível salvar agora.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Alternância do modo de custo */}
      <div className="flex flex-wrap items-center gap-1.5">
        {(["ITENS", "TOTAL"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setModo(m)}
            className={cn(
              "rounded-kx-pilula px-3 py-1 text-xs font-bold transition-colors",
              modo === m ? "bg-kx-primaria text-primary-foreground" : "bg-kx-superficie text-kx-texto-2 hover:text-kx-texto"
            )}
          >
            {m === "ITENS" ? "Custo por item" : "Custo total da nota"}
          </button>
        ))}
      </div>

      {modo === "TOTAL" ? (
        <div className="flex flex-col gap-1.5 rounded-kx-painel border border-kx-painel-borda bg-kx-painel p-4">
          <label htmlFor="custo-total" className="text-xs font-bold text-kx-texto">
            Custo total da nota (R$)
          </label>
          <Input
            id="custo-total"
            inputMode="decimal"
            placeholder="0,00"
            className="max-w-[200px] border-kx-campo-borda bg-kx-superficie text-kx-texto"
            value={custoTotal}
            onChange={(e) => setCustoTotal(e.target.value)}
          />
          <span className="text-xs text-kx-legenda">Atalho: um valor só para a nota inteira, sem detalhar por produto.</span>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {nota.itens.length === 0 ? (
            <li className="rounded-kx-painel border border-kx-painel-borda bg-kx-painel px-4 py-6 text-center text-sm text-kx-legenda">
              Esta nota não trouxe itens do Bling. Use o “Custo total da nota”.
            </li>
          ) : (
            nota.itens.map((item) => {
              const custo = paraCentavos(custos[item.id] ?? "");
              const lucro = custo === null ? null : item.valorTotalVendaCentavos - custo;
              return (
                <li key={item.id} className="flex flex-col gap-2 rounded-kx-painel border border-kx-painel-borda bg-kx-painel p-4 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-bold text-kx-texto">{item.descricao}</span>
                    <span className="text-xs text-kx-legenda">
                      {item.quantidade.toLocaleString("pt-BR")} × {formatarReais(item.valorUnitarioVendaCentavos)} ={" "}
                      {formatarReais(item.valorTotalVendaCentavos)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex flex-col">
                      <label htmlFor={`custo-${item.id}`} className="text-[11px] font-bold uppercase tracking-wide text-kx-legenda">
                        Custo (R$)
                      </label>
                      <Input
                        id={`custo-${item.id}`}
                        inputMode="decimal"
                        placeholder="0,00"
                        className="w-28 border-kx-campo-borda bg-kx-superficie text-kx-texto"
                        value={custos[item.id] ?? ""}
                        onChange={(e) => setCustos((atual) => ({ ...atual, [item.id]: e.target.value }))}
                      />
                    </div>
                    <div className="flex w-24 flex-col items-end">
                      <span className="text-[11px] font-bold uppercase tracking-wide text-kx-legenda">Lucro</span>
                      <span className={cn("text-sm font-bold", lucro === null ? "text-kx-legenda" : lucro < 0 ? "text-kx-erro-texto" : "text-kx-texto")}>
                        {lucro === null ? "—" : formatarReais(lucro)}
                      </span>
                    </div>
                  </div>
                </li>
              );
            })
          )}
        </ul>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-kx-painel-borda pt-3">
        <div className="text-sm text-kx-legenda">
          {previa ? (
            <span>
              Custo <span className="font-bold text-kx-texto">{formatarReais(previa.custo)}</span> · Lucro bruto{" "}
              <span className={cn("font-bold", previa.lucro < 0 ? "text-kx-erro-texto" : "text-kx-texto")}>{formatarReais(previa.lucro)}</span>
            </span>
          ) : (
            <span>Preencha o custo para ver o lucro.</span>
          )}
        </div>
        <Button type="button" disabled={salvando} onClick={() => void salvar()}>
          {salvando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />}
          Salvar custos
        </Button>
      </div>
    </div>
  );
}
