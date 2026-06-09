"use client";

import { useMemo, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { TipoPeca } from "@prisma/client";
import { toast } from "sonner";
import { adicionarItemOS } from "@/app/actions/os-itens";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type ItemOSTabela = {
  id: string;
  descricao: string;
  tipoPeca: TipoPeca;
  custoPeca: number;
  valorCobrado: number;
  criadoEm: string;
};

type PropsSecaoItensOS = {
  osId: string;
  numeroOs: number;
  itens: ItemOSTabela[];
  desabilitarCadastro?: boolean;
};

const opcoesTipoPeca: Array<{ value: TipoPeca; label: string }> = [
  { value: "TELA", label: "Tela" },
  { value: "BATERIA", label: "Bateria" },
  { value: "CONECTOR_CARGA", label: "Conector de Carga" },
  { value: "TAMPA_IPHONE", label: "Tampa iPhone" },
  { value: "TAMPA_ANDROID", label: "Tampa Android" },
  { value: "OUTROS", label: "Outros" },
];

const formatarMoeda = (valor: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valor);

export function SecaoItensOS({ osId, numeroOs, itens, desabilitarCadastro = false }: PropsSecaoItensOS) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [tipoPeca, setTipoPeca] = useState<TipoPeca>("TELA");
  const [descricao, setDescricao] = useState("");
  const [custoPeca, setCustoPeca] = useState<string>("");
  const [valorManual, setValorManual] = useState<string>("");

  const custoPecaNumero = Number(custoPeca || 0);
  const valorManualNumero = Number(valorManual || 0);

  // O valor cobrado ao cliente é sempre o valor manual informado — sem cálculo automático de markup.
  const valorPreview = valorManualNumero;

  const totalOS = useMemo(() => {
    return itens.reduce((total, item) => total + item.valorCobrado, 0);
  }, [itens]);

  const limparFormulario = () => {
    setDescricao("");
    setCustoPeca("");
    setValorManual("");
    setTipoPeca("TELA");
  };

  const aoSubmeter = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (desabilitarCadastro) {
      toast.error("Esta OS esta em modo visualizacao. Cadastre a OS no banco para adicionar itens.");
      return;
    }

    if (!descricao.trim()) {
      toast.error("Informe a descricao da peca ou servico.");
      return;
    }

    if (!Number.isFinite(custoPecaNumero) || custoPecaNumero < 0) {
      toast.error("Informe um custo valido para a peca.");
      return;
    }

    if (tipoPeca === "OUTROS" && (!Number.isFinite(valorManualNumero) || valorManualNumero <= 0)) {
      toast.error("Informe o valor manual para itens do tipo OUTROS.");
      return;
    }

    if (tipoPeca !== "OUTROS" && (!Number.isFinite(valorManualNumero) || valorManualNumero <= 0)) {
      toast.error("Informe o valor cobrado ao cliente.");
      return;
    }

    startTransition(async () => {
      try {
        await adicionarItemOS(osId, {
          tipoPeca,
          descricao,
          custoPeca: custoPecaNumero,
          valorManual: valorManualNumero,
        });

        toast.success("Item adicionado com sucesso na ordem de servico.");
        limparFormulario();
        router.refresh();
      } catch (error) {
        const mensagem = error instanceof Error ? error.message : "Erro ao adicionar item na ordem de servico.";
        toast.error(mensagem);
      }
    });
  };

  return (
    <div className="space-y-6">
      <Card className="border-zinc-200 dark:border-zinc-800 bg-white dark:bg-slate-800 p-5">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Adicionar Peca/Servico
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            OS #{numeroOs} — Informe o valor cobrado ao cliente manualmente.
          </p>
        </div>

        <form onSubmit={aoSubmeter} className="mt-4 space-y-0">

          {/* Grade de campos — 12 colunas para distribuição precisa */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">

            {/* Tipo da Peça — 3 colunas */}
            <div className="md:col-span-3 flex flex-col gap-1.5">
              <Label htmlFor="tipo-peca" className="text-sm text-slate-600 dark:text-slate-400">
                Tipo da Peça
              </Label>
              <Select value={tipoPeca} onValueChange={(valor) => setTipoPeca(valor as TipoPeca)}>
                <SelectTrigger id="tipo-peca" className="h-10">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {opcoesTipoPeca.map((tipo) => (
                    <SelectItem key={tipo.value} value={tipo.value}>
                      {tipo.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Descrição — 5 colunas */}
            <div className="md:col-span-5 flex flex-col gap-1.5">
              <Label htmlFor="descricao-item" className="text-sm text-slate-600 dark:text-slate-400">
                Descrição
              </Label>
              <Input
                id="descricao-item"
                className="h-10"
                value={descricao}
                onChange={(evento) => setDescricao(evento.target.value)}
                placeholder="Ex: Troca de tela OLED"
              />
            </div>

            {/* Custo da Peça — 2 colunas */}
            <div className="md:col-span-2 flex flex-col gap-1.5">
              <Label htmlFor="custo-peca" className="text-sm text-slate-600 dark:text-slate-400">
                Custo (R$)
              </Label>
              <Input
                id="custo-peca"
                className="h-10"
                type="number"
                min="0"
                step="0.01"
                value={custoPeca}
                onChange={(evento) => setCustoPeca(evento.target.value)}
                placeholder="0,00"
              />
            </div>

            {/* Valor Cobrado ao Cliente — 2 colunas */}
            <div className="md:col-span-2 flex flex-col gap-1.5">
              <Label htmlFor="valor-manual" className="text-sm text-slate-600 dark:text-slate-400 whitespace-nowrap">
                Cobrado (R$)
              </Label>
              <Input
                id="valor-manual"
                className="h-10"
                type="number"
                min="0"
                step="0.01"
                value={valorManual}
                onChange={(evento) => setValorManual(evento.target.value)}
                placeholder="0,00"
              />
            </div>
          </div>

          {/* Linha de ação — separada visualmente do grid de campos */}
          <div className="flex items-center gap-6 mt-6 pt-4 border-t border-zinc-200 dark:border-zinc-700/50">
            <Button type="submit" disabled={isPending || desabilitarCadastro}>
              {isPending ? "Adicionando..." : "Adicionar Item"}
            </Button>
            <Badge variant="secondary" className="text-sm">
              Valor para o Cliente: {formatarMoeda(valorPreview)}
            </Badge>
          </div>

          {/* Aviso quando OS está em modo visualização */}
          {desabilitarCadastro && (
            <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
              Cadastro de itens indisponível nesta OS porque ela não foi carregada do banco de dados.
            </p>
          )}
        </form>
      </Card>

      <Card className="border-zinc-200 dark:border-zinc-800 bg-white dark:bg-slate-800 p-0">
        <div className="p-5 border-b border-zinc-200 dark:border-zinc-700">
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Itens da Ordem de Servico</h3>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Descricao</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead className="text-right">Custo</TableHead>
              <TableHead className="text-right">Valor Cobrado</TableHead>
              <TableHead className="text-right">Criado em</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {itens.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-slate-500 py-8">
                  Nenhum item adicionado nesta OS.
                </TableCell>
              </TableRow>
            )}

            {itens.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{item.descricao}</TableCell>
                <TableCell>{item.tipoPeca.replaceAll("_", " ")}</TableCell>
                <TableCell className="text-right">{formatarMoeda(item.custoPeca)}</TableCell>
                <TableCell className="text-right font-semibold">{formatarMoeda(item.valorCobrado)}</TableCell>
                <TableCell className="text-right text-slate-500">
                  {new Date(item.criadoEm).toLocaleDateString("pt-BR")}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <div className="p-5 border-t border-zinc-200 dark:border-zinc-700 flex items-center justify-end">
          <p className="text-lg font-bold text-emerald-600">Total da OS: {formatarMoeda(totalOS)}</p>
        </div>
      </Card>
    </div>
  );
}
