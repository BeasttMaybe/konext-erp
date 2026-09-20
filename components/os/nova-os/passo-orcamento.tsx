"use client";

import { useState } from "react";
import { useFormContext, useFieldArray } from "react-hook-form";
import { Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const CAMPO = "h-[46px] rounded-kx-botao border-kx-campo-borda bg-kx-superficie px-3.5 text-sm text-kx-texto placeholder:text-kx-placeholder";

function formatarMoeda(valor: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor);
}

interface PropsPassoOrcamento {
  nomeClienteResumo: string;
  prazoGarantiaPadraoDias: number;
}

export function PassoOrcamento({ nomeClienteResumo, prazoGarantiaPadraoDias }: PropsPassoOrcamento) {
  const { control, watch } = useFormContext();
  const { fields, append, remove } = useFieldArray({ control, name: "itensOrcamento" });

  const [descricaoNova, setDescricaoNova] = useState("");
  const [custoNovo, setCustoNovo] = useState("");
  const [valorNovo, setValorNovo] = useState("");

  const marca = watch("marca");
  const modelo = watch("modelo");
  const itens = watch("itensOrcamento") || [];
  const valorPrevisto = itens.reduce((total: number, item: { valorCobrado?: number }) => total + Number(item.valorCobrado || 0), 0);

  const aparelhoResumo = [marca, modelo].filter((parte) => String(parte ?? "").trim()).join(" ") || "Não informado";

  const adicionarItem = () => {
    const descricao = descricaoNova.trim();
    if (!descricao) return;

    append({
      tipo: "OUTROS",
      descricao,
      custoPeca: Number(custoNovo || 0),
      valorCobrado: Number(valorNovo || 0),
    });
    setDescricaoNova("");
    setCustoNovo("");
    setValorNovo("");
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-kx-cartao bg-kx-superficie p-4">
        <span className="text-sm font-bold text-kx-texto">Orçamento inicial</span>
        <span className="text-xs text-kx-legenda">
          Opcional agora. As peças e serviços podem ser lançados depois, na tela da OS.
        </span>

        <div className="grid grid-cols-[minmax(0,1.6fr)_140px_140px_auto] items-end gap-2.5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nova-item-descricao" className="text-[13px] font-bold text-kx-texto">
              Descrição
            </Label>
            <Input
              id="nova-item-descricao"
              placeholder="Ex.: troca de tela"
              className={CAMPO}
              value={descricaoNova}
              onChange={(evento) => setDescricaoNova(evento.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nova-item-custo" className="text-[13px] font-bold text-kx-texto">
              Custo da peça
            </Label>
            <Input
              id="nova-item-custo"
              type="number"
              step="0.01"
              placeholder="R$ 0,00"
              className={CAMPO}
              value={custoNovo}
              onChange={(evento) => setCustoNovo(evento.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nova-item-valor" className="text-[13px] font-bold text-kx-texto">
              Valor ao cliente
            </Label>
            <Input
              id="nova-item-valor"
              type="number"
              step="0.01"
              placeholder="R$ 0,00"
              className={CAMPO}
              value={valorNovo}
              onChange={(evento) => setValorNovo(evento.target.value)}
            />
          </div>
          {/* Tipo fixo em OUTROS: o passo de orcamento inicial nao mostra o
              seletor de tipo (a referencia tambem nao mostra) — o tipo real
              da peca e ajustado depois, na tela da OS, onde o seletor existe. */}
          <Button
            type="button"
            variant="outline"
            className="h-[44px] rounded-kx-botao border-kx-campo-borda px-4 text-sm"
            onClick={adicionarItem}
          >
            Adicionar
          </Button>
        </div>

        {fields.length > 0 && (
          <div className="flex flex-col gap-2 border-t border-kx-painel-borda pt-3">
            {fields.map((field, index) => (
              <div key={field.id} className="flex items-center gap-3 text-sm">
                <span className="flex-1 truncate text-kx-texto">{watch(`itensOrcamento.${index}.descricao`) || "(sem descrição)"}</span>
                <span className="w-24 text-right text-kx-legenda">{formatarMoeda(Number(watch(`itensOrcamento.${index}.custoPeca`) || 0))}</span>
                <span className="w-24 text-right font-bold text-kx-texto">{formatarMoeda(Number(watch(`itensOrcamento.${index}.valorCobrado`) || 0))}</span>
                <button
                  type="button"
                  onClick={() => remove(index)}
                  aria-label="Remover item"
                  className="text-kx-erro-icone hover:opacity-80"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-4 rounded-kx-cartao bg-kx-superficie p-4">
        <div className="flex flex-col gap-0.5">
          <span className="text-[13px] font-bold text-kx-texto">Prazo de garantia</span>
          <span className="text-[11px] text-kx-legenda">Definido automaticamente na entrega, a partir da configuração da empresa</span>
        </div>
        <span className="ml-auto text-sm font-bold text-kx-texto">{prazoGarantiaPadraoDias} dias</span>
      </div>

      <div className="flex flex-col gap-2 rounded-kx-cartao bg-kx-cartao p-4">
        <span className="text-[13px] font-bold text-kx-texto">Resumo</span>
        <div className="flex justify-between text-[13px] text-kx-texto-2">
          <span>Cliente</span>
          <span>{nomeClienteResumo || "Não selecionado"}</span>
        </div>
        <div className="flex justify-between text-[13px] text-kx-texto-2">
          <span>Aparelho</span>
          <span>{aparelhoResumo}</span>
        </div>
        <div className="flex justify-between text-[13px] text-kx-texto-2">
          <span>Entra em</span>
          <span>Orçamento</span>
        </div>
        <div className="flex justify-between text-sm font-extrabold text-kx-texto">
          <span>Valor previsto</span>
          <span className="tabular-nums">{formatarMoeda(valorPrevisto)}</span>
        </div>
      </div>
    </div>
  );
}
