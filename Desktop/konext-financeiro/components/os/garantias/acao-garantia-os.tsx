"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Printer } from "lucide-react";
import { toast } from "sonner";
import { gerarTermoGarantiaOS } from "@/app/actions/garantias";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type AcaoGarantiaOSProps = {
  osId: string;
  statusOS: string;
  possuiTermoGarantia: boolean;
  possuiItens?: boolean;
  mostrarTextoBloqueio?: boolean;
};

const STATUS_PERMITE_GARANTIA = "PRONTO";

const tituloModalGarantia = "Gerar termo de garantia";
const labelPrazoGarantia = "Prazo de garantia (dias)";
const placeholderPrazoGarantia = "Ex: 90";
const ajudaPrazoGarantia = "Informe quantos dias de garantia este aparelho tera.";
const botaoCancelar = "Cancelar";
const botaoGerarGarantia = "Gerar garantia";
const mensagemGarantiaGerada = "Termo de garantia gerado com sucesso.";
const erroPrazoObrigatorio = "Informe o prazo de garantia.";
const erroPrazoInvalido = "Informe um prazo de garantia valido.";
const mensagemBloqueio = "A garantia podera ser gerada quando a OS estiver como Pronto.";
const mensagemBloqueioSemItens = "Cadastre uma peca ou servico antes de gerar a garantia.";

function validarPrazoGarantiaDias(valor: string): string | null {
  if (!valor.trim()) {
    return erroPrazoObrigatorio;
  }

  const numero = Number(valor);
  if (!Number.isInteger(numero) || numero < 1 || numero > 365) {
    return erroPrazoInvalido;
  }

  return null;
}

export function AcaoGarantiaOS({
  osId,
  statusOS,
  possuiTermoGarantia,
  possuiItens = true,
  mostrarTextoBloqueio = false,
}: AcaoGarantiaOSProps) {
  const router = useRouter();
  const [modalAberto, setModalAberto] = useState(false);
  const [prazoGarantiaDias, setPrazoGarantiaDias] = useState("90");
  const [isPending, startTransition] = useTransition();

  const erroPrazo = useMemo(() => validarPrazoGarantiaDias(prazoGarantiaDias), [prazoGarantiaDias]);

  const podeGerarGarantia = statusOS === STATUS_PERMITE_GARANTIA && !possuiTermoGarantia && possuiItens;
  const mensagemBloqueioAtual = !possuiItens ? mensagemBloqueioSemItens : mensagemBloqueio;

  const handleGerarGarantia = () => {
    const erroAtual = validarPrazoGarantiaDias(prazoGarantiaDias);
    if (erroAtual) {
      toast.error(erroAtual);
      return;
    }

    startTransition(async () => {
      const resultado = await gerarTermoGarantiaOS({
        osId,
        prazoGarantiaDias: Number(prazoGarantiaDias),
      });

      if (!resultado.sucesso) {
        toast.error(resultado.erro);
        return;
      }

      toast.success(resultado.mensagem || mensagemGarantiaGerada);
      setModalAberto(false);
      router.push(`/os/${osId}/garantia`);
      router.refresh();
    });
  };

  if (possuiTermoGarantia) {
    return (
      <Button variant="outline" size="sm" className="h-9" asChild>
        <Link href={`/os/${osId}/garantia`} target="_blank">
          <Printer className="h-4 w-4 mr-2" />
          Imprimir termo
        </Link>
      </Button>
    );
  }

  if (!podeGerarGarantia) {
    return (
      <div className="relative flex items-center">
        <Button variant="outline" size="sm" className="h-9" disabled title={mensagemBloqueioAtual}>
          Gerar garantia
        </Button>
        {mostrarTextoBloqueio && (
          <p className="absolute left-0 top-full mt-1 whitespace-nowrap text-xs text-slate-500">{mensagemBloqueioAtual}</p>
        )}
      </div>
    );
  }

  return (
    <>
      <Button variant="outline" size="sm" className="h-9" onClick={() => setModalAberto(true)}>
        Gerar garantia
      </Button>

      <Dialog open={modalAberto} onOpenChange={(aberto) => !isPending && setModalAberto(aberto)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tituloModalGarantia}</DialogTitle>
            <DialogDescription>
              Defina o prazo para gerar o termo desta OS.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="prazo-garantia-os">{labelPrazoGarantia}</Label>
            <Input
              id="prazo-garantia-os"
              type="number"
              min={1}
              max={365}
              step={1}
              inputMode="numeric"
              placeholder={placeholderPrazoGarantia}
              value={prazoGarantiaDias}
              onChange={(event) => setPrazoGarantiaDias(event.target.value)}
              disabled={isPending}
            />
            <p className="text-xs text-slate-500">{ajudaPrazoGarantia}</p>
            {erroPrazo && <p className="text-xs text-red-600">{erroPrazo}</p>}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setModalAberto(false)} disabled={isPending}>
              {botaoCancelar}
            </Button>
            <Button type="button" onClick={handleGerarGarantia} disabled={Boolean(erroPrazo) || isPending}>
              {isPending ? "Gerando..." : botaoGerarGarantia}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
