"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PackageCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModalFinalizarOS, type ConfirmacaoFinalizacaoPayload } from "@/components/os/modal-finalizar-os";
import { ModalEntregarSemServico } from "@/components/os/modal-entregar-sem-servico";
import { finalizarOrdemServico, finalizarSemServico } from "@/app/actions/os";
import type { PendenciaFinalizacao } from "@/lib/dominio/os/regras-finalizacao";

type PropsAcaoEntregaOS = {
  osId: string;
  numeroOs: string;
  ehRetornoGarantia: boolean;
  possuiItens: boolean;
  prazoGarantiaPadraoDias: number;
  prazoMinimoGarantiaDias: number;
  prazoMaximoGarantiaDias: number;
};

/**
 * Mesmos dois caminhos do Kanban (ver components/os/dashboard-os.tsx), so que
 * sem o movimento otimista de coluna — aqui e so um botao na tela de detalhe.
 * OS com item -> ModalFinalizarOS; OS sem item -> ModalEntregarSemServico.
 */
export function AcaoEntregaOS({
  osId,
  numeroOs,
  ehRetornoGarantia,
  possuiItens,
  prazoGarantiaPadraoDias,
  prazoMinimoGarantiaDias,
  prazoMaximoGarantiaDias,
}: PropsAcaoEntregaOS) {
  const router = useRouter();
  const [dialogoAberto, setDialogoAberto] = useState<"finalizar" | "sem-servico" | null>(null);
  const [processando, setProcessando] = useState(false);
  const [pendencias, setPendencias] = useState<PendenciaFinalizacao[]>([]);

  const os = { id: osId, numeroOS: numeroOs };

  const abrirEntrega = () => {
    setPendencias([]);
    setDialogoAberto(possuiItens ? "finalizar" : "sem-servico");
  };

  const confirmarFinalizacao = async (payload?: ConfirmacaoFinalizacaoPayload) => {
    if (processando) return;

    try {
      setProcessando(true);

      const resultado = await finalizarOrdemServico({
        osId,
        prazoGarantiaDias: payload?.prazoGarantiaDias ?? null,
      });

      if (!resultado.sucesso) {
        toast.error(resultado.erro);
        setPendencias(resultado.pendencias ?? []);
        return;
      }

      toast.success(
        resultado.garantiaGerada
          ? `OS ${numeroOs} finalizada com garantia gerada.`
          : `OS ${numeroOs} finalizada com sucesso.`
      );
      setDialogoAberto(null);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível finalizar a ordem de serviço.");
    } finally {
      setProcessando(false);
    }
  };

  const confirmarSemServico = async (motivo: string) => {
    if (processando) return;

    try {
      setProcessando(true);

      const resultado = await finalizarSemServico({ osId, motivo });

      if (!resultado.sucesso) {
        toast.error(resultado.erro);
        return;
      }

      toast.success(resultado.mensagem);
      setDialogoAberto(null);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível encerrar a OS sem serviço.");
    } finally {
      setProcessando(false);
    }
  };

  return (
    <>
      <Button type="button" size="sm" className="h-[42px]" onClick={abrirEntrega}>
        <PackageCheck className="mr-2 h-4 w-4" />
        Entregar e finalizar
      </Button>

      <ModalFinalizarOS
        aberta={dialogoAberto === "finalizar"}
        onAbrirMudar={(aberta) => {
          if (!aberta && !processando) {
            setDialogoAberto(null);
            setPendencias([]);
          }
        }}
        os={os}
        processando={processando}
        exigePrazoGarantia={!ehRetornoGarantia}
        prazoPadraoDias={prazoGarantiaPadraoDias}
        prazoMinimoDias={prazoMinimoGarantiaDias}
        prazoMaximoDias={prazoMaximoGarantiaDias}
        pendencias={pendencias}
        onConfirmar={confirmarFinalizacao}
      />

      <ModalEntregarSemServico
        aberta={dialogoAberto === "sem-servico"}
        onAbrirMudar={(aberta) => {
          if (!aberta && !processando) {
            setDialogoAberto(null);
          }
        }}
        os={os}
        processando={processando}
        onConfirmar={confirmarSemServico}
      />
    </>
  );
}
