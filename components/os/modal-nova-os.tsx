"use client";

import { useState } from "react";
import { FormProvider, useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AbaEntradaEquipamento } from "./abas/aba-entrada-equipamento";
import { AbaOrcamento } from "./abas/aba-orcamento";
import { AbaHistoricoStatus } from "./abas/aba-historico-status";

// Validação com Zod
const esquemaNovaOS = z.object({
  clienteId: z.string().min(1, "Cliente é obrigatório"),
  
  // Equipamento
  marca: z.string().optional(),
  modelo: z.string().optional(),
  imei: z.string().optional(),
  senha: z.string().optional(),
  senhaDesenho: z.string().optional(),
  
  // Checklist
  relatoCliente: z.string().min(1, "Relato do cliente é obrigatório"),
  condicaoFisica: z.string().optional(),
  acessorios: z.string().optional(),
  
  // Orçamento
  itensOrcamento: z.array(
    z.object({
      tipo: z.enum([
        "TELA",
        "BATERIA",
        "CONECTOR_CARGA",
        "TAMPA_IPHONE",
        "TAMPA_ANDROID",
        "OUTROS",
      ]),
      descricao: z.string().min(1, "Descrição obrigatória"),
      custoPeca: z.coerce.number().min(0, "Custo não pode ser negativo"),
      valorCobrado: z.coerce.number().min(0, "Valor não pode ser negativo"),
    })
  ).optional(),
  
  // Status
  status: z.enum([
    "AGUARDANDO_ORCAMENTO",
    "AGUARDANDO_APROVACAO",
    "APROVADO",
    "AGUARDANDO_PECA",
    "EM_MANUTENCAO",
    "PRONTO",
    "ENTREGUE",
  ]).default("AGUARDANDO_ORCAMENTO"),
  
  observacoesInternas: z.string().optional(),
});

type DadosNovaOS = z.infer<typeof esquemaNovaOS>;
type DadosNovaOSPayload = DadosNovaOS & { equipamento: string };

interface ModalNovaOSProps {
  aberta: boolean;
  onAbrirMudar: (aberta: boolean) => void;
  onSalvar?: (dados: DadosNovaOSPayload) => Promise<void>;
  /** Quando informado, o cliente é pré-selecionado automaticamente ao abrir o modal. */
  clienteIdInicial?: string;
}

export function ModalNovaOS({
  aberta,
  onAbrirMudar,
  onSalvar,
  clienteIdInicial,
}: ModalNovaOSProps) {
  const [abaAtiva, setAbaAtiva] = useState("entrada");
  const [salvando, setSalvando] = useState(false);
  
  const formulario = useForm<DadosNovaOS>({
    resolver: zodResolver(esquemaNovaOS) as unknown as Resolver<DadosNovaOS>,
    mode: "onChange",
    defaultValues: {
      clienteId: "",
      marca: "",
      modelo: "",
      imei: "",
      senha: "",
      senhaDesenho: "",
      relatoCliente: "",
      condicaoFisica: "",
      acessorios: "",
      itensOrcamento: [],
      status: "AGUARDANDO_ORCAMENTO",
      observacoesInternas: "",
    },
  });

  const buildEquipamento = (marca?: string, modelo?: string) => {
    const parts = [marca?.trim(), modelo?.trim()].filter(Boolean);
    if (parts.length === 0) return "Aparelho sem identificação";
    return parts.join(" ");
  };

  const handleSalvar = async (dados: DadosNovaOS) => {
    try {
      setSalvando(true);
      const payload: DadosNovaOSPayload = {
        ...dados,
        equipamento: buildEquipamento(dados.marca, dados.modelo),
      };

      await onSalvar?.(payload);
      formulario.reset();
      onAbrirMudar(false);
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : "Nao foi possivel salvar a ordem de servico.";
      toast.error(mensagem);
    } finally {
      setSalvando(false);
    }
  };

  const handleFechar = () => {
    formulario.reset();
    onAbrirMudar(false);
  };

  return (
    <Dialog open={aberta} onOpenChange={onAbrirMudar}>
      <DialogContent className="max-w-6xl max-h-[92vh] overflow-y-auto border-zinc-200/70 bg-background p-0 shadow-2xl">
        <DialogHeader>
          <div className="rounded-t-lg border-b border-border bg-gradient-to-r from-slate-50 via-white to-slate-50 px-6 py-5 dark:from-slate-900 dark:via-slate-950 dark:to-slate-900">
            <DialogTitle className="text-xl font-semibold tracking-tight">Nova Ordem de Serviço</DialogTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Preencha os dados de entrada, orçamento e status para registrar a OS com segurança.
            </p>
          </div>
        </DialogHeader>

        <FormProvider {...formulario}>
          <form onSubmit={formulario.handleSubmit(handleSalvar)} className="space-y-5 px-6 pb-6">
            <Tabs value={abaAtiva} onValueChange={setAbaAtiva} className="w-full">
              <TabsList className="grid h-11 w-full grid-cols-3 rounded-xl bg-muted/60 p-1">
                <TabsTrigger value="entrada">
                  Entrada de Equipamento
                </TabsTrigger>
                <TabsTrigger value="orcamento">
                  Orçamento & Precificação
                </TabsTrigger>
                <TabsTrigger value="historico">
                  Histórico & Status
                </TabsTrigger>
              </TabsList>

              <TabsContent value="entrada" className="mt-4 data-[state=active]:animate-in data-[state=active]:fade-in-0 data-[state=active]:slide-in-from-bottom-1 data-[state=active]:duration-200">
                <Card className="border-border/70 bg-background/70 p-4 shadow-sm transition-all duration-200 sm:p-5">
                  <AbaEntradaEquipamento clienteIdInicial={clienteIdInicial} />
                </Card>
              </TabsContent>

              <TabsContent value="orcamento" className="mt-4 data-[state=active]:animate-in data-[state=active]:fade-in-0 data-[state=active]:slide-in-from-bottom-1 data-[state=active]:duration-200">
                <Card className="border-border/70 bg-background/70 p-4 shadow-sm transition-all duration-200 sm:p-5">
                  <AbaOrcamento />
                </Card>
              </TabsContent>

              <TabsContent value="historico" className="mt-4 data-[state=active]:animate-in data-[state=active]:fade-in-0 data-[state=active]:slide-in-from-bottom-1 data-[state=active]:duration-200">
                <Card className="border-border/70 bg-background/70 p-4 shadow-sm transition-all duration-200 sm:p-5">
                  <AbaHistoricoStatus />
                </Card>
              </TabsContent>
            </Tabs>

            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <Button variant="outline" onClick={handleFechar}>
                Cancelar
              </Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={salvando}>
                {salvando ? "Salvando..." : "Salvar Ordem de Serviço"}
              </Button>
            </div>
          </form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
}
