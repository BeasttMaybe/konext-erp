"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FormProvider, useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AbaEntradaEquipamento } from "@/components/os/abas/aba-entrada-equipamento";
import { AbaHistoricoStatus } from "@/components/os/abas/aba-historico-status";
import { AbaOrcamento } from "@/components/os/abas/aba-orcamento";
import { buscarClientesOS, criarOrdemServico } from "@/app/actions/os";

const newServiceOrderSchema = z.object({
  clienteId: z.string().min(1, "Cliente é obrigatório"),
  marca: z.string().optional(),
  modelo: z.string().optional(),
  imei: z.string().optional(),
  senha: z.string().optional(),
  senhaDesenho: z.string().optional(),
  relatoCliente: z.string().min(1, "Relato do cliente é obrigatório"),
  condicaoFisica: z.string().optional(),
  acessorios: z.string().optional(),
  itensOrcamento: z
    .array(
      z.object({
        tipo: z.enum(["TELA", "BATERIA", "CONECTOR_CARGA", "TAMPA_IPHONE", "TAMPA_ANDROID", "OUTROS"]),
        descricao: z.string().min(1, "Descrição obrigatória"),
        custoPeca: z.coerce.number().min(0, "Custo não pode ser negativo"),
        valorCobrado: z.coerce.number().min(0, "Valor não pode ser negativo"),
      })
    )
    .optional(),
  status: z
    .enum([
      "AGUARDANDO_ORCAMENTO",
      "AGUARDANDO_APROVACAO",
      "APROVADO",
      "AGUARDANDO_PECA",
      "EM_MANUTENCAO",
      "PRONTO",
      "ENTREGUE",
    ])
    .default("AGUARDANDO_ORCAMENTO"),
  observacoesInternas: z.string().optional(),
});

type NewServiceOrderData = z.infer<typeof newServiceOrderSchema>;
type NewServiceOrderPayload = NewServiceOrderData & { equipamento: string };

type ProposalItemInitialData = {
  descricao: string;
  quantidade: number;
  precoUnitario: number;
  descontoPercentual: number;
  subtotal: number;
};

export type OrdemServicoFormInitialData = {
  proposalId: string;
  clientName: string;
  equipment: string | null;
  reportedDefect: string | null;
  items: ProposalItemInitialData[];
};

interface OrdemServicoFormProps {
  initialData?: OrdemServicoFormInitialData | null;
}

export function OrdemServicoForm({ initialData = null }: OrdemServicoFormProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("entrada");
  const [isSaving, setIsSaving] = useState(false);
  const [clientSearchInitialValue, setClientSearchInitialValue] = useState(initialData?.clientName ?? "");

  const defaultValues = useMemo<NewServiceOrderData>(() => {
    const mappedItems = (initialData?.items ?? []).map((item) => ({
      tipo: "OUTROS" as const,
      descricao: item.quantidade > 1 ? `${item.descricao} (Qtd: ${item.quantidade})` : item.descricao,
      custoPeca: 0,
      valorCobrado: Number(item.subtotal ?? 0),
    }));

    return {
      clienteId: "",
      marca: "",
      modelo: initialData?.equipment?.trim() ?? "",
      imei: "",
      senha: "",
      senhaDesenho: "",
      relatoCliente: initialData?.reportedDefect?.trim() ?? "",
      condicaoFisica: "",
      acessorios: "",
      itensOrcamento: mappedItems,
      status: "AGUARDANDO_ORCAMENTO",
      observacoesInternas: "",
    };
  }, [initialData]);

  const form = useForm<NewServiceOrderData>({
    resolver: zodResolver(newServiceOrderSchema) as unknown as Resolver<NewServiceOrderData>,
    mode: "onChange",
    defaultValues,
  });

  const buildEquipment = (brand?: string, model?: string) => {
    const normalizedModel = model?.trim();
    const normalizedBrand = brand?.trim();

    if (normalizedModel) {
      return normalizedBrand ? `${normalizedBrand} ${normalizedModel}` : normalizedModel;
    }

    return normalizedBrand || "Aparelho sem identificação";
  };

  useEffect(() => {
    let isMounted = true;

    const resolveClientId = async () => {
      const clientName = initialData?.clientName?.trim();

      if (!clientName) {
        return;
      }

      setClientSearchInitialValue(clientName);

      try {
        const candidates = await buscarClientesOS(clientName);
        if (!isMounted || candidates.length === 0) {
          return;
        }

        const exactMatch = candidates.find(
          (candidate) => candidate.nomeRazaoSocial.trim().toLowerCase() === clientName.toLowerCase()
        );

        const selectedClient = exactMatch ?? candidates[0];

        form.setValue("clienteId", selectedClient.id, {
          shouldValidate: true,
          shouldDirty: false,
        });
      } catch {
        // Keep manual selection flow when automatic matching fails.
      }
    };

    resolveClientId();

    return () => {
      isMounted = false;
    };
  }, [form, initialData?.clientName]);

  const handleSubmit = async (values: NewServiceOrderData) => {
    try {
      setIsSaving(true);

      const payload: NewServiceOrderPayload = {
        ...values,
        equipamento: buildEquipment(values.marca, values.modelo),
      };

      const createdServiceOrder = await criarOrdemServico(payload);

      toast.success("Ordem de serviço criada com sucesso.");
      router.push(`/os/${createdServiceOrder.id}`);
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível criar a ordem de serviço.";
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    router.push("/os");
  };

  return (
    <div className="w-full h-full flex flex-col overflow-hidden bg-transparent">
      <div className="border-b border-slate-200/70 bg-white/75 px-6 py-6 backdrop-blur-sm dark:border-slate-700/70 dark:bg-slate-900/50 lg:px-8">
        <div className="max-w-7xl">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-50">Nova Ordem de Serviço</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-2 text-sm">
            Preencha os dados de entrada, orçamento e status para registrar a OS.
          </p>
          {initialData && (
            <Badge variant="secondary" className="mt-3">
              OS pré-preenchida a partir da Proposta #{initialData.proposalId.slice(0, 8).toUpperCase()}
            </Badge>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="px-6 lg:px-8 py-6">
          <div className="max-w-7xl mx-auto">
            <FormProvider {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-5">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                  <TabsList className="grid h-11 w-full grid-cols-3 rounded-xl bg-muted/60 p-1">
                    <TabsTrigger value="entrada">Entrada de Equipamento</TabsTrigger>
                    <TabsTrigger value="orcamento">Orçamento & Precificação</TabsTrigger>
                    <TabsTrigger value="historico">Histórico & Status</TabsTrigger>
                  </TabsList>

                  <TabsContent
                    value="entrada"
                    className="mt-4 data-[state=active]:animate-in data-[state=active]:fade-in-0 data-[state=active]:slide-in-from-bottom-1 data-[state=active]:duration-200"
                  >
                    <Card className="border-border/70 bg-background/70 p-4 shadow-sm transition-all duration-200 sm:p-5">
                      <AbaEntradaEquipamento clienteNomeInicial={clientSearchInitialValue} />
                    </Card>
                  </TabsContent>

                  <TabsContent
                    value="orcamento"
                    className="mt-4 data-[state=active]:animate-in data-[state=active]:fade-in-0 data-[state=active]:slide-in-from-bottom-1 data-[state=active]:duration-200"
                  >
                    <Card className="border-border/70 bg-background/70 p-4 shadow-sm transition-all duration-200 sm:p-5">
                      <AbaOrcamento />
                    </Card>
                  </TabsContent>

                  <TabsContent
                    value="historico"
                    className="mt-4 data-[state=active]:animate-in data-[state=active]:fade-in-0 data-[state=active]:slide-in-from-bottom-1 data-[state=active]:duration-200"
                  >
                    <Card className="border-border/70 bg-background/70 p-4 shadow-sm transition-all duration-200 sm:p-5">
                      <AbaHistoricoStatus />
                    </Card>
                  </TabsContent>
                </Tabs>

                <div className="flex justify-end gap-2 border-t border-border pt-4">
                  <Button type="button" variant="outline" onClick={handleCancel}>
                    Cancelar
                  </Button>
                  <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={isSaving}>
                    {isSaving ? "Salvando..." : "Salvar Ordem de Serviço"}
                  </Button>
                </div>
              </form>
            </FormProvider>
          </div>
        </div>
      </div>
    </div>
  );
}