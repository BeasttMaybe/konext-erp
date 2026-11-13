"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

import { salvarCompromisso, type CompromissoDetalhe } from "@/app/actions/agenda";
import type { ClienteBuscaCRM } from "@/app/actions/crm";
import { SeletorClienteCRM } from "@/components/financeiro/seletor-cliente-crm";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ANTECEDENCIAS_DE_AVISO, ANTECEDENCIA_PADRAO, rotuloDaAntecedencia } from "@/lib/dominio/agenda/agenda";

const CAMPO = "h-11 border-kx-campo-borda bg-kx-superficie text-kx-texto placeholder:text-kx-placeholder";
const SELECT =
  "h-11 w-full rounded-kx-botao border border-kx-campo-borda bg-kx-superficie px-3 text-sm text-kx-texto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kx-foco";

type Props = {
  /** null = novo */
  compromisso: CompromissoDetalhe | null;
  dataInicial: string;
  podeVerClientes: boolean;
  onFechar: () => void;
  /** Recebe a data (AAAA-MM-DD) gravada, para a agenda ir ate ela. */
  onSalvo: (data: string) => void;
};

/** Criar ou editar um compromisso da agenda. */
export function DialogoCompromisso({ compromisso, dataInicial, podeVerClientes, onFechar, onSalvo }: Props) {
  const [titulo, setTitulo] = useState(compromisso?.titulo ?? "");
  const [data, setData] = useState(compromisso?.data ?? dataInicial);
  const [diaInteiro, setDiaInteiro] = useState(compromisso?.diaInteiro ?? false);
  const [horaInicio, setHoraInicio] = useState(compromisso?.horaInicio ?? "09:00");
  const [horaFim, setHoraFim] = useState(compromisso?.horaFim ?? "");
  const [aviso, setAviso] = useState<string>(
    compromisso ? (compromisso.avisarMinutosAntes === null ? "nenhum" : String(compromisso.avisarMinutosAntes)) : String(ANTECEDENCIA_PADRAO)
  );
  const [descricao, setDescricao] = useState(compromisso?.descricao ?? "");
  const [cliente, setCliente] = useState<ClienteBuscaCRM | null>(
    compromisso?.cliente
      ? { id: compromisso.cliente.id, nomeRazaoSocial: compromisso.cliente.nome, nomeFantasia: null, documento: null, telefone: "" }
      : null
  );
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const salvar = async () => {
    setSalvando(true);
    setErro(null);
    try {
      const resultado = await salvarCompromisso(compromisso?.id ?? null, {
        titulo,
        data,
        diaInteiro,
        horaInicio,
        horaFim,
        avisarMinutosAntes: aviso,
        descricao,
        clienteId: cliente?.id ?? "",
      });
      if (!resultado.sucesso) {
        setErro(resultado.erro);
        return;
      }
      onSalvo(data);
    } catch {
      setErro("Não foi possível salvar. Tente de novo.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open onOpenChange={(abrir) => !abrir && onFechar()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{compromisso ? "Editar compromisso" : "Novo compromisso"}</DialogTitle>
          <DialogDescription>Aparece na agenda de toda a equipe e avisa no sininho na hora escolhida.</DialogDescription>
        </DialogHeader>

        <form
          className="flex flex-col gap-4"
          onSubmit={(evento) => {
            evento.preventDefault();
            void salvar();
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="compromisso-titulo" className="text-xs font-bold text-kx-texto">
              Título
            </Label>
            <Input
              id="compromisso-titulo"
              autoFocus
              maxLength={120}
              placeholder="Ex.: Buscar peças no fornecedor"
              className={CAMPO}
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="compromisso-data" className="text-xs font-bold text-kx-texto">
                Data
              </Label>
              <Input id="compromisso-data" type="date" className={CAMPO} value={data} onChange={(e) => setData(e.target.value)} />
            </div>
            <label className="flex h-11 cursor-pointer items-center gap-2 text-sm text-kx-texto">
              <Checkbox checked={diaInteiro} onCheckedChange={(v) => setDiaInteiro(v === true)} />
              Dia inteiro
            </label>
          </div>

          {!diaInteiro && (
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="compromisso-inicio" className="text-xs font-bold text-kx-texto">
                  Início
                </Label>
                <Input id="compromisso-inicio" type="time" className={CAMPO} value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="compromisso-fim" className="text-xs font-bold text-kx-texto">
                  Término <span className="font-normal text-kx-legenda">(opcional)</span>
                </Label>
                <Input id="compromisso-fim" type="time" className={CAMPO} value={horaFim} onChange={(e) => setHoraFim(e.target.value)} />
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="compromisso-aviso" className="text-xs font-bold text-kx-texto">
              Avisar no sininho
            </Label>
            <select id="compromisso-aviso" className={SELECT} value={aviso} onChange={(e) => setAviso(e.target.value)}>
              {ANTECEDENCIAS_DE_AVISO.map((minutos) => (
                <option key={minutos} value={String(minutos)}>
                  {rotuloDaAntecedencia(minutos)}
                </option>
              ))}
              <option value="nenhum">{rotuloDaAntecedencia(null)}</option>
            </select>
          </div>

          {podeVerClientes && (
            <SeletorClienteCRM
              label="Cliente (opcional)"
              clienteSelecionado={cliente}
              onSelecionarCliente={setCliente}
              onLimparCliente={() => setCliente(null)}
              papelFiltro="TODOS"
            />
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="compromisso-descricao" className="text-xs font-bold text-kx-texto">
              Observações <span className="font-normal text-kx-legenda">(opcional)</span>
            </Label>
            <Textarea
              id="compromisso-descricao"
              rows={3}
              maxLength={2000}
              className="border-kx-campo-borda bg-kx-superficie text-kx-texto placeholder:text-kx-placeholder"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
            />
          </div>

          {erro ? (
            <p role="alert" className="rounded-kx-botao border border-kx-erro bg-kx-erro-fundo px-3 py-2 text-sm text-kx-erro-texto">
              {erro}
            </p>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onFechar} disabled={salvando}>
              Cancelar
            </Button>
            <Button type="submit" disabled={salvando}>
              {salvando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              {compromisso ? "Salvar" : "Agendar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
