"use client";

import { useState, type RefObject } from "react";
import { Search, TriangleAlert, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ModalNovoCliente } from "@/components/crm/modal-novo-cliente";
import { criarCliente } from "@/app/actions/crm";
import type { FormCliente } from "@/lib/validations/crm";
import type { ClientePDV } from "@/app/actions/pdv";
import { DADOS_CLIENTE_CONSUMIDOR_FINAL } from "@/lib/dominio/crm/consumidor-final";
import { MENSAGEM_CLIENTE_OBRIGATORIO_PARA_PRAZO } from "@/lib/pdv/formatacao-pagamento-pdv";

interface PropsEtapaClientePdv {
  buscaCliente: string;
  onBuscaClienteChange: (valor: string) => void;
  buscaClienteRef: RefObject<HTMLInputElement | null>;
  clientesFiltrados: ClientePDV[];
  carregandoClientes: boolean;
  clienteSelecionadoId: string;
  onSelecionarCliente: (clienteId: string) => void;
  onClienteCriado: (cliente: ClientePDV) => void;
  /** true quando a venda já tem boleto/crediário lançado (Etapa Pagamento) e nenhum cliente real foi escolhido. */
  precisaClienteReal: boolean;
}

/**
 * Etapa 2 — Cliente (referência: docs/design/referencia-pdv-tres-etapas.html).
 * "Consumidor Final" (Fase 3-2C) aparece como a primeira opção da lista,
 * sempre visível e selecionada por padrão — selecionar qualquer outro
 * cliente da busca substitui essa seleção. A trava de boleto/crediário usa
 * literalmente a MESMA mensagem pt-BR do servidor
 * (MENSAGEM_CLIENTE_OBRIGATORIO_PARA_PRAZO, hoje também em
 * app/actions/pdv.ts#processarVenda), pra não ter duas mensagens diferentes
 * pro mesmo erro.
 */
export function EtapaClientePdv({
  buscaCliente,
  onBuscaClienteChange,
  buscaClienteRef,
  clientesFiltrados,
  carregandoClientes,
  clienteSelecionadoId,
  onSelecionarCliente,
  onClienteCriado,
  precisaClienteReal,
}: PropsEtapaClientePdv) {
  const [modalNovoClienteAberto, setModalNovoClienteAberto] = useState(false);
  const [salvandoCliente, setSalvandoCliente] = useState(false);

  const handleSalvarNovoCliente = async (dados: FormCliente): Promise<{ sucesso: boolean }> => {
    setSalvandoCliente(true);
    try {
      const resultado = await criarCliente(dados);
      if (!resultado.sucesso) {
        toast.error(resultado.mensagem);
        return { sucesso: false };
      }

      toast.success("Cliente cadastrado com sucesso.");
      onClienteCriado({
        id: resultado.cliente.id,
        nomeRazaoSocial: resultado.cliente.nomeRazaoSocial,
        documento: resultado.cliente.documento,
        telefone: resultado.cliente.telefone,
      });
      setModalNovoClienteAberto(false);
      return { sucesso: true };
    } finally {
      setSalvandoCliente(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
      <div className="flex flex-col gap-1">
        <span className="text-[17px] font-bold text-kx-texto">Quem está comprando?</span>
        <span className="text-[13px] text-kx-legenda">Opcional numa venda à vista. Obrigatório no crediário ou boleto.</span>
      </div>

      {precisaClienteReal && (
        <div className="flex items-start gap-2.5 rounded-kx-cartao border border-kx-erro-borda bg-kx-erro-fundo px-3.5 py-3">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-kx-erro-icone" aria-hidden="true" />
          <p className="text-[13px] text-kx-erro-texto">{MENSAGEM_CLIENTE_OBRIGATORIO_PARA_PRAZO}</p>
        </div>
      )}

      <label className="flex flex-col gap-2">
        <span className="text-[13px] font-bold text-kx-texto">
          Buscar cliente <span className="text-[11px] font-normal text-kx-legenda">F3</span>
        </span>
        <div className="flex h-12 items-center gap-2.5 rounded-kx-botao border border-kx-campo-borda bg-kx-superficie px-3.5">
          <Search className="h-[18px] w-[18px] shrink-0 text-kx-legenda" aria-hidden="true" />
          <input
            ref={buscaClienteRef}
            placeholder="Nome, CPF/CNPJ ou telefone"
            value={buscaCliente}
            onChange={(evento) => onBuscaClienteChange(evento.target.value)}
            className="flex-1 bg-transparent text-sm text-kx-texto outline-none placeholder:text-kx-placeholder"
          />
        </div>
      </label>

      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-1">
        <button
          type="button"
          onClick={() => onSelecionarCliente("")}
          className={`flex min-h-14 items-center gap-3 rounded-kx-cartao border px-3.5 text-left ${
            !clienteSelecionadoId ? "border-kx-primaria bg-kx-primaria/10" : "border-kx-painel-borda bg-kx-cartao"
          }`}
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-kx-superficie text-xs font-extrabold text-kx-texto-2">
            CF
          </span>
          <span className="flex flex-col">
            <span className="text-sm font-bold text-kx-texto">{DADOS_CLIENTE_CONSUMIDOR_FINAL.nomeRazaoSocial}</span>
            <span className="text-xs text-kx-legenda">Sem identificação — venda à vista</span>
          </span>
          {!clienteSelecionadoId && (
            <span className="ml-auto shrink-0 rounded-kx-pilula bg-kx-sucesso-fundo px-2.5 py-0.5 text-xs font-bold text-kx-sucesso-texto">
              Selecionado
            </span>
          )}
        </button>

        {carregandoClientes && buscaCliente.trim() && <p className="px-1 text-xs text-kx-legenda">Buscando clientes...</p>}

        {!carregandoClientes && buscaCliente.trim() && clientesFiltrados.length === 0 && (
          <p className="px-1 text-xs text-kx-legenda">Nenhum cliente encontrado.</p>
        )}

        {clientesFiltrados.map((cliente) => {
          const selecionado = clienteSelecionadoId === cliente.id;
          const iniciais = cliente.nomeRazaoSocial
            .trim()
            .split(/\s+/)
            .slice(0, 2)
            .map((parte) => parte[0]?.toUpperCase() ?? "")
            .join("");

          return (
            <button
              key={cliente.id}
              type="button"
              onClick={() => onSelecionarCliente(cliente.id)}
              className={`flex min-h-14 items-center gap-3 rounded-kx-cartao border px-3.5 text-left ${
                selecionado ? "border-kx-primaria bg-kx-primaria/10" : "border-kx-painel-borda bg-kx-cartao"
              }`}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-kx-superficie text-xs font-extrabold text-kx-texto-2">
                {iniciais || "?"}
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-bold text-kx-texto">{cliente.nomeRazaoSocial}</span>
                <span className="truncate text-xs tabular-nums text-kx-legenda">
                  {cliente.documento || cliente.telefone || "Sem documento informado"}
                </span>
              </span>
              {selecionado && (
                <span className="ml-auto shrink-0 rounded-kx-pilula bg-kx-sucesso-fundo px-2.5 py-0.5 text-xs font-bold text-kx-sucesso-texto">
                  Selecionado
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div>
        <Button type="button" variant="outline" className="h-10 rounded-kx-botao" onClick={() => setModalNovoClienteAberto(true)}>
          <UserPlus className="mr-2 h-4 w-4" aria-hidden="true" />
          Cadastrar novo cliente
        </Button>
      </div>

      <ModalNovoCliente
        aberto={modalNovoClienteAberto}
        aoFechar={() => setModalNovoClienteAberto(false)}
        aoSalvar={handleSalvarNovoCliente}
        carregando={salvandoCliente}
      />
    </div>
  );
}
