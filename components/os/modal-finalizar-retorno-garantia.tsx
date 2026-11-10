"use client";

import { lerEntradaMonetaria, paraMoeda } from "@/lib/dinheiro";
import { useMemo, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import type { OrdemServico } from "@/types/os";
import type { ResultadoRetornoGarantia } from "@prisma/client";

export type FinalizacaoRetornoGarantiaPayload = {
  resultado: Exclude<ResultadoRetornoGarantia, "EM_ANALISE">;
  analiseTecnica?: string;
  descricaoServico?: string;
  pecasAdicionais?: string;
  houveTroca: boolean;
  houveCobranca: boolean;
  valorAdicional?: number;
  observacoesTecnicas?: string;
};

type ModalFinalizarRetornoGarantiaProps = {
  aberta: boolean;
  onAbrirMudar: (aberta: boolean) => void;
  os: OrdemServico | null;
  processando: boolean;
  onConfirmar: (dados: FinalizacaoRetornoGarantiaPayload) => Promise<void>;
};

const resultadosFinais: Array<Exclude<ResultadoRetornoGarantia, "EM_ANALISE">> = [
  "PROCEDENTE",
  "IMPROCEDENTE",
  "SEM_GARANTIA",
  "RESOLVIDO_SEM_TROCA",
  "TROCA_REALIZADA",
  "COBRANCA_ADICIONAL",
];

const labelResultado: Record<Exclude<ResultadoRetornoGarantia, "EM_ANALISE">, string> = {
  PROCEDENTE: "Procedente",
  IMPROCEDENTE: "Improcedente",
  SEM_GARANTIA: "Sem cobertura de garantia",
  RESOLVIDO_SEM_TROCA: "Resolvido sem troca",
  TROCA_REALIZADA: "Troca realizada",
  COBRANCA_ADICIONAL: "Cobrança adicional",
};

function validarCobranca(houveCobranca: boolean, valorAdicional: string): string | null {
  if (!houveCobranca) return null;

  // Pelo leitor unico, igual ao resto do sistema: `Number("1.250,00")` e
  // NaN, e a cobranca do retorno era recusada como "valor invalido".
  const centavos = lerEntradaMonetaria(valorAdicional);
  if (centavos === null || centavos <= 0) {
    return "Informe um valor adicional valido.";
  }

  return null;
}

export function ModalFinalizarRetornoGarantia({
  aberta,
  onAbrirMudar,
  os,
  processando,
  onConfirmar,
}: ModalFinalizarRetornoGarantiaProps) {
  const [resultado, setResultado] = useState<Exclude<ResultadoRetornoGarantia, "EM_ANALISE">>("PROCEDENTE");
  const [analiseTecnica, setAnaliseTecnica] = useState("");
  const [descricaoServico, setDescricaoServico] = useState("");
  const [pecasAdicionais, setPecasAdicionais] = useState("");
  const [observacoesTecnicas, setObservacoesTecnicas] = useState("");
  const [houveTroca, setHouveTroca] = useState(false);
  const [houveCobranca, setHouveCobranca] = useState(false);
  const [valorAdicional, setValorAdicional] = useState("");

  const erroCobranca = useMemo(
    () => validarCobranca(houveCobranca, valorAdicional),
    [houveCobranca, valorAdicional]
  );

  const confirmar = async () => {
    if (erroCobranca) return;

    await onConfirmar({
      resultado,
      analiseTecnica,
      descricaoServico,
      pecasAdicionais,
      observacoesTecnicas,
      houveTroca,
      houveCobranca,
      valorAdicional: houveCobranca ? paraMoeda(lerEntradaMonetaria(valorAdicional) ?? 0) : undefined,
    });
  };

  return (
    <AlertDialog
      open={aberta}
      onOpenChange={(novoEstado) => {
        if (processando) return;
        onAbrirMudar(novoEstado);
      }}
    >
      <AlertDialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <AlertDialogHeader className="pb-1">
          <AlertDialogTitle className="text-base">Finalizar retorno de garantia</AlertDialogTitle>
          <AlertDialogDescription className="text-xs">
            {`Retorno da ${os?.numeroOS ?? "OS selecionada"} — resultado técnico e impacto financeiro.`}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="overflow-y-auto flex-1 space-y-3 pr-1">
          <div className="space-y-1">
            <Label className="text-xs">Resultado final</Label>
            <Select value={resultado} onValueChange={(valor) => setResultado(valor as Exclude<ResultadoRetornoGarantia, "EM_ANALISE">)}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {resultadosFinais.map((valor) => (
                  <SelectItem key={valor} value={valor} className="text-sm">
                    {labelResultado[valor]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="analise-tecnica-retorno" className="text-xs">Análise técnica</Label>
              <Textarea
                id="analise-tecnica-retorno"
                rows={2}
                className="text-sm resize-none"
                value={analiseTecnica}
                onChange={(event) => setAnaliseTecnica(event.target.value)}
                disabled={processando}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="descricao-servico-retorno" className="text-xs">Serviço executado</Label>
              <Textarea
                id="descricao-servico-retorno"
                rows={2}
                className="text-sm resize-none"
                value={descricaoServico}
                onChange={(event) => setDescricaoServico(event.target.value)}
                disabled={processando}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="pecas-adicionais-retorno" className="text-xs">Peças adicionais</Label>
              <Textarea
                id="pecas-adicionais-retorno"
                rows={2}
                className="text-sm resize-none"
                value={pecasAdicionais}
                onChange={(event) => setPecasAdicionais(event.target.value)}
                disabled={processando}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="observacoes-tecnicas-retorno" className="text-xs">Observações técnicas</Label>
              <Textarea
                id="observacoes-tecnicas-retorno"
                rows={2}
                className="text-sm resize-none"
                value={observacoesTecnicas}
                onChange={(event) => setObservacoesTecnicas(event.target.value)}
                disabled={processando}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-md border px-3 py-2">
            <div className="flex items-center gap-2">
              <Checkbox
                id="houve-troca-retorno"
                checked={houveTroca}
                onCheckedChange={(valor) => setHouveTroca(Boolean(valor))}
                disabled={processando}
              />
              <Label htmlFor="houve-troca-retorno" className="text-sm cursor-pointer">Houve troca de peça</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="houve-cobranca-retorno"
                checked={houveCobranca}
                onCheckedChange={(valor) => setHouveCobranca(Boolean(valor))}
                disabled={processando}
              />
              <Label htmlFor="houve-cobranca-retorno" className="text-sm cursor-pointer">Houve cobrança adicional</Label>
            </div>

            {houveCobranca && (
              <div className="flex items-center gap-2 w-full mt-1">
                <Label htmlFor="valor-adicional-retorno" className="text-xs whitespace-nowrap">Valor (R$)</Label>
                <Input
                  id="valor-adicional-retorno"
                  type="text"
                  inputMode="decimal"
                  className="h-7 text-sm w-36"
                  value={valorAdicional}
                  onChange={(event) => setValorAdicional(event.target.value)}
                  disabled={processando}
                />
                {erroCobranca && <p className="text-xs text-kx-erro-texto">{erroCobranca}</p>}
              </div>
            )}
          </div>
        </div>

        <AlertDialogFooter className="pt-2">
          <AlertDialogCancel disabled={processando}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={Boolean(erroCobranca) || processando}
            onClick={(event) => {
              event.preventDefault();
              void confirmar();
            }}
          >
            {processando ? "Finalizando..." : "Finalizar retorno"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
