"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { excluirOrdemServico } from "@/app/actions/os";
import { useTemPermissao } from "@/contextos/contexto-permissoes";

type PropsAcaoExcluirOS = {
  osId: string;
  numeroOs: string;
};

const MOTIVO_MINIMO = 5;

/**
 * Exclusao de OS agora so existe aqui, na tela de detalhe — nunca num clique
 * direto de lista (Fase 1C-2 follow-up, Parte 2: a lista de Finalizadas e
 * Entregues nao oferece mais essa acao). Mesmo dialogo e texto que a lista
 * usava antes, so realocado — nenhuma regra de negocio mudou.
 */
export function AcaoExcluirOS({ osId, numeroOs }: PropsAcaoExcluirOS) {
  const router = useRouter();
  const podeExcluirOS = useTemPermissao("os.excluir");
  const [aberto, setAberto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [excluindo, setExcluindo] = useState(false);

  if (!podeExcluirOS) {
    return null;
  }

  const handleExcluir = async () => {
    if (excluindo) return;

    const motivoNormalizado = motivo.trim();

    if (motivoNormalizado.length < MOTIVO_MINIMO) {
      toast.error("Informe o motivo da exclusão.");
      return;
    }

    try {
      setExcluindo(true);

      const resultado = await excluirOrdemServico({ osId, motivoExclusao: motivoNormalizado });

      if (!resultado.sucesso) {
        toast.error(resultado.erro);
        return;
      }

      toast.success(resultado.mensagem);
      setAberto(false);
      setMotivo("");
      router.push("/os?modo=excluidas");
      router.refresh();
    } catch {
      toast.error("Não foi possível excluir a OS. Tente novamente.");
    } finally {
      setExcluindo(false);
    }
  };

  return (
    <>
      <DropdownMenuItem
        onSelect={(evento) => {
          evento.preventDefault();
          setAberto(true);
        }}
        className="text-destructive focus:text-destructive"
      >
        <Trash2 className="mr-2 h-4 w-4" />
        Excluir OS
      </DropdownMenuItem>

      <AlertDialog
        open={aberto}
        onOpenChange={(valor) => {
          if (!valor && !excluindo) {
            setAberto(false);
            setMotivo("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir ordem de serviço</AlertDialogTitle>
            <AlertDialogDescription>
              {`Tem certeza que deseja excluir a OS ${numeroOs}? Essa ação não poderá ser desfeita pela tela atual.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="motivo-exclusao">Motivo da exclusão</Label>
            <Textarea
              id="motivo-exclusao"
              value={motivo}
              onChange={(evento) => setMotivo(evento.target.value)}
              placeholder="Ex: OS criada em duplicidade, cliente cancelou, erro no cadastro..."
              minLength={MOTIVO_MINIMO}
              maxLength={500}
              disabled={excluindo}
            />
            <p className="text-xs text-kx-legenda">{motivo.trim().length}/500 caracteres</p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={excluindo}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={excluindo || motivo.trim().length < MOTIVO_MINIMO}
              onClick={(evento) => {
                evento.preventDefault();
                void handleExcluir();
              }}
            >
              {excluindo ? "Excluindo..." : "Excluir OS"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
