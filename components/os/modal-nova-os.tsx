"use client";

import { useState } from "react";
import { FormProvider, useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AssistenteNovaOS } from "./nova-os/assistente-nova-os";
import {
  ProvedorFotosPendentes,
  useFotosPendentes,
} from "./nova-os/fotos-da-entrada";
import { validarFormatoImei } from "@/lib/dominio/os/validacao-imei";

// Validação com Zod
const esquemaNovaOS = z.object({
  clienteId: z.string().min(1, "Cliente é obrigatório"),

  // Equipamento
  marca: z.string().optional(),
  modelo: z.string().optional(),
  imei: z.string().optional().refine((valor) => validarFormatoImei(valor).valido, {
    message: "IMEI/nº de série deve conter apenas letras, números, espaço ou hífen.",
  }),
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
  /**
   * Devolve o id da OS criada, quando quem salva souber dele: é com ele que
   * as fotos tiradas no cadastro sobem, logo depois.
   */
  onSalvar?: (dados: DadosNovaOSPayload) => Promise<string | void>;
  /** Quando informado, o cliente é pré-selecionado automaticamente ao abrir o modal. */
  clienteIdInicial?: string;
  /**
   * Chamado com o id da OS recém-criada quando o salvamento veio do botão
   * "Salvar e enviar pelo celular". Sem este callback o botão não aparece —
   * o assistente não tem onde mostrar o QR code sozinho.
   */
  aoPedirLinkDeFotos?: (ordemServicoId: string) => void;
}

export function ModalNovaOS({
  aberta,
  onAbrirMudar,
  onSalvar,
  clienteIdInicial,
  aoPedirLinkDeFotos,
}: ModalNovaOSProps) {
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

  const fotosPendentes = useFotosPendentes();

  /**
   * `abrirLinkDepois` entra como ARGUMENTO, e não como estado ou ref.
   *
   * Os dois botões que salvam querem coisas diferentes no fim, e a diferença
   * é conhecida no instante do clique. Guardá-la fora da chamada criaria um
   * valor que precisa ser zerado depois — e que, esquecido, faria o botão
   * normal abrir o QR code na vez seguinte.
   */
  const handleSalvar = async (dados: DadosNovaOS, abrirLinkDepois = false) => {
    try {
      setSalvando(true);
      const payload: DadosNovaOSPayload = {
        ...dados,
        equipamento: buildEquipamento(dados.marca, dados.modelo),
      };

      const ordemServicoId = await onSalvar?.(payload);

      // As fotos sobem DEPOIS da OS existir, porque antes disso não há id a que
      // ligá-las. Falha aqui não desfaz a OS: ela já está criada.
      if (typeof ordemServicoId === "string" && ordemServicoId.length > 0) {
        const { enviadas, falhas } = await fotosPendentes.enviarPara(ordemServicoId);

        if (falhas > 0) {
          toast.error(
            falhas === 1
              ? "A OS foi criada, mas 1 foto não subiu. Você pode adicioná-la na tela da OS."
              : `A OS foi criada, mas ${falhas} fotos não subiram. Você pode adicioná-las na tela da OS.`
          );
        } else if (enviadas > 0) {
          toast.success(enviadas === 1 ? "1 foto anexada à OS." : `${enviadas} fotos anexadas à OS.`);
        }
      }

      // O link do celular depende da OS ter nascido: se o salvamento falhou,
      // `ordemServicoId` não veio e não há nada a que ligar um link.
      if (abrirLinkDepois && typeof ordemServicoId === "string" && ordemServicoId) {
        aoPedirLinkDeFotos?.(ordemServicoId);
      }

      fotosPendentes.limpar();
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
      <DialogContent
        showCloseButton={false}
        className="flex max-h-[90vh] w-full max-w-[980px] flex-col overflow-hidden rounded-[26px] border-kx-painel-borda bg-kx-painel p-0"
      >
        <DialogTitle className="sr-only">Nova ordem de serviço</DialogTitle>
        <DialogDescription className="sr-only">
          Assistente de 3 passos para cadastrar uma nova ordem de serviço: cliente e aparelho, entrada e orçamento.
        </DialogDescription>
        <FormProvider {...formulario}>
          <ProvedorFotosPendentes
            valor={fotosPendentes}
            salvarEPedirLinkDoCelular={
              aoPedirLinkDeFotos
                ? () =>
                    void formulario.handleSubmit(
                      (dados) => handleSalvar(dados, true),
                      // Este botão salva a partir do PASSO 2, e o que falta
                      // pode estar no passo 1 — um IMEI com caractere
                      // inválido, por exemplo. Sem este aviso, o clique não
                      // faria nada: o erro ficaria marcado numa tela que a
                      // pessoa não está vendo, e o botão pareceria quebrado.
                      () =>
                        toast.error(
                          "Falta alguma coisa no cadastro. Confira os passos anteriores antes de salvar."
                        )
                    )()
                : undefined
            }
          >
          <form onSubmit={formulario.handleSubmit((dados) => handleSalvar(dados))} className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-6">
            <AssistenteNovaOS
              onCancelar={handleFechar}
              onSalvarClick={formulario.handleSubmit((dados) => handleSalvar(dados))}
              salvando={salvando}
              clienteIdInicial={clienteIdInicial}
            />
          </form>
          </ProvedorFotosPendentes>
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
}
