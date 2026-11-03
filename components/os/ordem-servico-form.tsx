"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FormProvider, useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { AssistenteNovaOS } from "@/components/os/nova-os/assistente-nova-os";
import { buscarClientesOS, criarOrdemServico } from "@/app/actions/os";
import {
  ProvedorFotosPendentes,
  useFotosPendentes,
} from "@/components/os/nova-os/fotos-da-entrada";
import { validarFormatoImei } from "@/lib/dominio/os/validacao-imei";

const newServiceOrderSchema = z.object({
  clienteId: z.string().min(1, "Cliente é obrigatório"),
  marca: z.string().optional(),
  modelo: z.string().optional(),
  imei: z.string().optional().refine((valor) => validarFormatoImei(valor).valido, {
    message: "IMEI/nº de série deve conter apenas letras, números, espaço ou hífen.",
  }),
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

  const fotosPendentes = useFotosPendentes();

  const handleSubmit = async (values: NewServiceOrderData) => {
    try {
      setIsSaving(true);

      const payload: NewServiceOrderPayload = {
        ...values,
        equipamento: buildEquipment(values.marca, values.modelo),
      };

      const createdServiceOrder = await criarOrdemServico(payload);

      // As fotos sobem DEPOIS da OS existir, porque antes disso não há id a que
      // ligá-las. Falha aqui não desfaz a OS: ela já está criada, e perder o
      // cadastro por causa de uma foto seria muito pior que subir a foto
      // depois, na tela da OS.
      const { enviadas, falhas } = await fotosPendentes.enviarPara(createdServiceOrder.id);

      if (falhas > 0) {
        toast.error(
          falhas === 1
            ? "A OS foi criada, mas 1 foto não subiu. Você pode adicioná-la na tela da OS."
            : `A OS foi criada, mas ${falhas} fotos não subiram. Você pode adicioná-las na tela da OS.`
        );
      } else {
        toast.success(
          enviadas > 0
            ? `Ordem de serviço criada com ${enviadas === 1 ? "1 foto" : `${enviadas} fotos`}.`
            : "Ordem de serviço criada com sucesso."
        );
      }

      fotosPendentes.limpar();
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
    <div className="flex h-full w-full items-start justify-center overflow-y-auto bg-kx-fundo p-6">
      <div className="flex w-full max-w-[980px] flex-col gap-4 rounded-[26px] border border-kx-painel-borda bg-kx-painel p-6">
        <FormProvider {...form}>
          <ProvedorFotosPendentes valor={fotosPendentes}>
          <form onSubmit={form.handleSubmit(handleSubmit)}>
            <AssistenteNovaOS
              onCancelar={handleCancel}
              onSalvarClick={form.handleSubmit(handleSubmit)}
              salvando={isSaving}
              clienteNomeInicial={clientSearchInitialValue}
              tituloExtra={
                initialData && (
                  <Badge variant="secondary" className="mt-1 w-fit">
                    OS pré-preenchida a partir da Proposta #{initialData.proposalId.slice(0, 8).toUpperCase()}
                  </Badge>
                )
              }
            />
          </form>
          </ProvedorFotosPendentes>
        </FormProvider>
      </div>
    </div>
  );
}