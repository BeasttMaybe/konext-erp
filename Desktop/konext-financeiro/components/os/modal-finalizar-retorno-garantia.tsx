"use client";

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

  const numero = Number(valorAdicional);
  if (!Number.isFinite(numero) || numero <= 0) {
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
      valorAdicional: houveCobranca ? Number(valorAdicional) : undefined,
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
      <AlertDialogContent className="max-w-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle>Finalizar retorno de garantia</AlertDialogTitle>
          <AlertDialogDescription>
            {`Conclua o retorno da ${os?.numeroOS ?? "OS selecionada"} com resultado técnico e impacto financeiro.`}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Resultado final</Label>
            <Select value={resultado} onValueChange={(valor) => setResultado(valor as Exclude<ResultadoRetornoGarantia, "EM_ANALISE">)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {resultadosFinais.map((valor) => (
                  <SelectItem key={valor} value={valor}>
                    {labelResultado[valor]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="analise-tecnica-retorno">Análise técnica</Label>
            <Textarea
              id="analise-tecnica-retorno"
              value={analiseTecnica}
              onChange={(event) => setAnaliseTecnica(event.target.value)}
              disabled={processando}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="descricao-servico-retorno">Serviço executado</Label>
            <Textarea
              id="descricao-servico-retorno"
              value={descricaoServico}
              onChange={(event) => setDescricaoServico(event.target.value)}
              disabled={processando}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="pecas-adicionais-retorno">Peças adicionais</Label>
            <Textarea
              id="pecas-adicionais-retorno"
              value={pecasAdicionais}
              onChange={(event) => setPecasAdicionais(event.target.value)}
              disabled={processando}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="observacoes-tecnicas-retorno">Observações técnicas</Label>
            <Textarea
              id="observacoes-tecnicas-retorno"
              value={observacoesTecnicas}
              onChange={(event) => setObservacoesTecnicas(event.target.value)}
              disabled={processando}
            />
          </div>

          <div className="space-y-3 rounded-md border p-3">
            <div className="flex items-center gap-2">
              <Checkbox
                id="houve-troca-retorno"
                checked={houveTroca}
                onCheckedChange={(valor) => setHouveTroca(Boolean(valor))}
                disabled={processando}
              />
              <Label htmlFor="houve-troca-retorno">Houve troca de peça</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="houve-cobranca-retorno"
                checked={houveCobranca}
                onCheckedChange={(valor) => setHouveCobranca(Boolean(valor))}
                disabled={processando}
              />
              <Label htmlFor="houve-cobranca-retorno">Houve cobrança adicional</Label>
            </div>

            {houveCobranca && (
              <div className="space-y-2">
                <Label htmlFor="valor-adicional-retorno">Valor adicional (R$)</Label>
                <Input
                  id="valor-adicional-retorno"
                  type="number"
                  min={0.01}
                  step={0.01}
                  value={valorAdicional}
                  onChange={(event) => setValorAdicional(event.target.value)}
                  disabled={processando}
                />
                {erroCobranca && <p className="text-xs text-red-600">{erroCobranca}</p>}
              </div>
            )}
          </div>
        </div>

        <AlertDialogFooter>
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
