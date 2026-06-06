"use client";

import { useEffect, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Cliente } from "@/types/os";
import { AbaEntradaEquipamento } from "./abas/aba-entrada-equipamento";
import { AbaOrcamento } from "./abas/aba-orcamento";
import { AbaHistoricoStatus } from "./abas/aba-historico-status";

// Validação com Zod
const esquemaNovaOS = z.object({
  clienteId: z.string().min(1, "Cliente é obrigatório"),
  
  // Equipamento
  equipamento: z.string().min(1, "Equipamento é obrigatório"),
  marca: z.string().optional(),
  modelo: z.string().optional(),
  numeroSerieImei: z.string().optional(),
  senhaAcesso: z.string().optional(),
  
  // Checklist
  relatoCliente: z.string().min(1, "Relato do cliente é obrigatório"),
  condicaoFisica: z.string().optional(),
  acessoriosDeixados: z.string().optional(),
  
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

interface ModalNovaOSProps {
  aberta: boolean;
  onAbrirMudar: (aberta: boolean) => void;
  clientes: Cliente[];
  onSalvar?: (dados: DadosNovaOS) => void;
}

export function ModalNovaOS({
  aberta,
  onAbrirMudar,
  clientes,
  onSalvar,
}: ModalNovaOSProps) {
  const [abaAtiva, setAbaAtiva] = useState("entrada");
  
  const formulario = useForm<DadosNovaOS>({
    resolver: zodResolver(esquemaNovaOS),
    mode: "onChange",
    defaultValues: {
      clienteId: "",
      equipamento: "",
      marca: "",
      modelo: "",
      numeroSerieImei: "",
      senhaAcesso: "",
      relatoCliente: "",
      condicaoFisica: "",
      acessoriosDeixados: "",
      itensOrcamento: [],
      status: "AGUARDANDO_ORCAMENTO",
      observacoesInternas: "",
    },
  });

  const handleSalvar = async (dados: DadosNovaOS) => {
    onSalvar?.(dados);
    formulario.reset();
    onAbrirMudar(false);
  };

  const handleFechar = () => {
    formulario.reset();
    onAbrirMudar(false);
  };

  return (
    <Dialog open={aberta} onOpenChange={onAbrirMudar}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Ordem de Serviço</DialogTitle>
        </DialogHeader>

        <FormProvider {...formulario}>
          <form onSubmit={formulario.handleSubmit(handleSalvar)} className="space-y-4">
            <Tabs value={abaAtiva} onValueChange={setAbaAtiva} className="w-full">
              <TabsList className="grid w-full grid-cols-3">
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

              <TabsContent value="entrada" className="space-y-4 mt-4">
                <AbaEntradaEquipamento clientes={clientes} />
              </TabsContent>

              <TabsContent value="orcamento" className="space-y-4 mt-4">
                <AbaOrcamento />
              </TabsContent>

              <TabsContent value="historico" className="space-y-4 mt-4">
                <AbaHistoricoStatus />
              </TabsContent>
            </Tabs>

            {/* Botões de ação */}
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={handleFechar}>
                Cancelar
              </Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                Salvar Ordem de Serviço
              </Button>
            </div>
          </form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
}
