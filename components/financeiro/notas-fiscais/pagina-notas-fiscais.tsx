"use client";

import { useMemo, useState, useTransition } from "react";
import {
  atualizarNotaFiscal,
  atualizarStatusNotaFiscal,
  criarNotaFiscal,
  listarNotasFiscais,
  type NotaFiscalLista,
} from "@/app/actions/notas-fiscais";
import type { StatusNotaFiscal } from "@prisma/client";
import { rotuloDaSituacaoDoBling } from "@/lib/dominio/bling/nota-de-saida";
import { sincronizarNotasDoBling } from "@/app/actions/bling-sincronizar";
import { useTemPermissao } from "@/contextos/contexto-permissoes";

type Props = {
  notasIniciais: NotaFiscalLista[];
  clientes: Array<{ id: string; nome: string }>;
};

const OPCOES_STATUS: StatusNotaFiscal[] = ["PENDENTE", "EMITIDA", "CANCELADA"];

export function PaginaNotasFiscais({ notasIniciais, clientes }: Props) {
  const podeLancar = useTemPermissao("financeiro.lancar");
  const podeEditar = useTemPermissao("financeiro.editar");
  const [notas, setNotas] = useState<NotaFiscalLista[]>(notasIniciais);
  const [busca, setBusca] = useState("");
  const [status, setStatus] = useState<StatusNotaFiscal |"TODAS">("TODAS");
  const [erro, setErro] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [sincronizando, setSincronizando] = useState(false);
  const [resumoDaSincronizacao, setResumoDaSincronizacao] = useState<string | null>(null);

  const [idEdicao, setIdEdicao] = useState<string | null>(null);
  const [numero, setNumero] = useState("");
  const [chaveAcesso, setChaveAcesso] = useState("");
  const [valorTotal, setValorTotal] = useState("0");
  const [clienteId, setClienteId] = useState<string>("");
  const [statusFormulario, setStatusFormulario] = useState<StatusNotaFiscal>("PENDENTE");

  const notasFiltradas = useMemo(() => {
    const buscaNormalizada = busca.trim().toLowerCase();

    return notas.filter((nota) => {
      const statusOk = status === "TODAS" || nota.status === status;
      const buscaOk =
        !buscaNormalizada ||
        nota.numero.toLowerCase().includes(buscaNormalizada) ||
        String(nota.chaveAcesso ?? "").toLowerCase().includes(buscaNormalizada) ||
        String(nota.clienteNome ?? "").toLowerCase().includes(buscaNormalizada);

      return statusOk && buscaOk;
    });
  }, [notas, busca, status]);

  function limparFormulario() {
    setIdEdicao(null);
    setNumero("");
    setChaveAcesso("");
    setValorTotal("0");
    setClienteId("");
    setStatusFormulario("PENDENTE");
  }

  function preencherFormulario(nota: NotaFiscalLista) {
    setIdEdicao(nota.id);
    setNumero(nota.numero);
    setChaveAcesso(nota.chaveAcesso ?? "");
    setValorTotal(String(nota.valorTotal));
    setClienteId(nota.clienteId ?? "");
    setStatusFormulario(nota.status);
  }

  function recarregarLista() {
    startTransition(async () => {
      const resultado = await listarNotasFiscais({ busca, status });
      if (!resultado.sucesso) {
        setErro(resultado.erro);
        return;
      }

      setNotas(resultado.dados);
    });
  }

  function salvarNotaFiscal() {
    setErro(null);
    setMensagem(null);

    const valorParse = Number(valorTotal);

    startTransition(async () => {
      const payload = {
        numero,
        chaveAcesso,
        valorTotal: valorParse,
        clienteId: clienteId || null,
        status: statusFormulario,
      };

      const resultado = idEdicao
        ? await atualizarNotaFiscal({ id: idEdicao, ...payload })
        : await criarNotaFiscal(payload);

      if (!resultado.sucesso) {
        setErro(resultado.erro);
        return;
      }

      setMensagem(resultado.mensagem);
      limparFormulario();
      recarregarLista();
    });
  }

  function alterarStatus(id: string, novoStatus: StatusNotaFiscal) {
    setErro(null);
    setMensagem(null);

    startTransition(async () => {
      const resultado = await atualizarStatusNotaFiscal({ id, status: novoStatus });
      if (!resultado.sucesso) {
        setErro(resultado.erro);
        return;
      }

      setMensagem(resultado.mensagem);
      recarregarLista();
    });
  }

  /**
   * A sincronização é limitada por execução: o Bling aceita 3 requisições por
   * segundo e o valor da nota só vem no detalhe, uma requisição por nota.
   * Então a lista aparece inteira na primeira passada e os valores vão
   * preenchendo — e a mensagem diz quantos faltam, para quem está olhando
   * saber que não travou.
   */
  async function sincronizarAgora() {
    setSincronizando(true);
    try {
      const resumo = await sincronizarNotasDoBling();

      setResumoDaSincronizacao(resumo.mensagem);
      if (resumo.sucesso) recarregarLista();
    } finally {
      setSincronizando(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-kx-painel-borda bg-kx-painel p-6">
        <div>
          <h1 className="text-2xl font-bold text-kx-texto">Notas Fiscais</h1>
          <p className="mt-1 max-w-xl text-sm text-kx-texto-2">
            As notas emitidas no Bling aparecem aqui. A Konext só lê — nada é emitido,
            cancelado ou alterado lá.
          </p>
        </div>

        {podeEditar && (
          <div className="text-right">
            <button
              onClick={sincronizarAgora}
              disabled={sincronizando}
              className="rounded-md bg-kx-primaria px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
            >
              {sincronizando ? "Buscando no Bling…" : "Sincronizar com o Bling"}
            </button>
            {resumoDaSincronizacao && (
              <p className="mt-2 max-w-xs text-xs text-kx-legenda">{resumoDaSincronizacao}</p>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-kx-painel-borda bg-kx-painel p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-kx-legenda">Filtros</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <input
              value={busca}
              onChange={(event) => setBusca(event.target.value)}
              placeholder="Buscar por numero, chave ou cliente"
              className="rounded-md border border-kx-campo-borda bg-kx-painel px-3 py-2 text-sm"
            />
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as StatusNotaFiscal |"TODAS")}
              className="rounded-md border border-kx-campo-borda bg-kx-painel px-3 py-2 text-sm"
            >
              <option value="TODAS">Todos os status</option>
              {OPCOES_STATUS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={recarregarLista}
            disabled={isPending}
            className="mt-3 rounded-md bg-kx-superficie px-4 py-2 text-sm font-medium text-kx-texto disabled:opacity-60"
          >
            Atualizar lista
          </button>
        </div>

        {(podeLancar || podeEditar) && (
        <div className="rounded-xl border border-kx-painel-borda bg-kx-painel p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-kx-legenda">
            {idEdicao ? "Editar nota fiscal" : "Nova nota fiscal"}
          </h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <input
              value={numero}
              onChange={(event) => setNumero(event.target.value)}
              placeholder="Numero"
              className="rounded-md border border-kx-campo-borda bg-kx-painel px-3 py-2 text-sm"
            />
            <input
              value={chaveAcesso}
              onChange={(event) => setChaveAcesso(event.target.value)}
              placeholder="Chave de acesso"
              className="rounded-md border border-kx-campo-borda bg-kx-painel px-3 py-2 text-sm"
            />
            <input
              value={valorTotal}
              onChange={(event) => setValorTotal(event.target.value)}
              type="number"
              min="0"
              step="0.01"
              placeholder="Valor total"
              className="rounded-md border border-kx-campo-borda bg-kx-painel px-3 py-2 text-sm"
            />
            <select
              value={statusFormulario}
              onChange={(event) => setStatusFormulario(event.target.value as StatusNotaFiscal)}
              className="rounded-md border border-kx-campo-borda bg-kx-painel px-3 py-2 text-sm"
            >
              {OPCOES_STATUS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <select
              value={clienteId}
              onChange={(event) => setClienteId(event.target.value)}
              className="rounded-md border border-kx-campo-borda bg-kx-painel px-3 py-2 text-sm md:col-span-2"
            >
              <option value="">Sem cliente vinculado</option>
              {clientes.map((cliente) => (
                <option key={cliente.id} value={cliente.id}>
                  {cliente.nome}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-3 flex gap-2">
            <button
              onClick={salvarNotaFiscal}
              disabled={isPending}
              className="rounded-md bg-kx-sucesso px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              {idEdicao ? "Salvar alteracoes" : "Criar nota"}
            </button>
            {idEdicao ? (
              <button
                onClick={limparFormulario}
                className="rounded-md border border-kx-campo-borda px-4 py-2 text-sm font-medium"
              >
                Cancelar edicao
              </button>
            ) : null}
          </div>
        </div>
        )}
      </div>

      {erro ? (
        <div className="rounded-md border border-kx-erro-borda/40 bg-kx-erro-fundo px-3 py-2 text-sm text-kx-erro-texto">
          {erro}
        </div>
      ) : null}
      {mensagem ? (
        <div className="rounded-md border border-kx-sucesso/40 bg-kx-sucesso-fundo px-3 py-2 text-sm text-kx-sucesso-texto">
          {mensagem}
        </div>
      ) : null}

      <div className="rounded-xl border border-kx-painel-borda bg-kx-painel p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-kx-legenda">Lista de notas fiscais</h2>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] table-auto border-collapse text-sm">
            <thead>
              <tr className="border-b border-kx-painel-borda text-left">
                <th className="px-2 py-2">Número</th>
                <th className="px-2 py-2">Cliente</th>
                <th className="px-2 py-2">Valor</th>
                <th className="px-2 py-2">Situação</th>
                <th className="px-2 py-2">Emissão</th>
                <th className="px-2 py-2">Venda</th>
                <th className="px-2 py-2">Arquivos</th>
                {podeEditar && <th className="px-2 py-2">Acoes</th>}
              </tr>
            </thead>
            <tbody>
              {notasFiltradas.map((nota) => (
                <tr key={nota.id} className="border-b border-kx-painel-borda">
                  <td className="px-2 py-2 font-medium">
                    {nota.serie ? `${nota.serie}/` : ""}
                    {nota.numero}
                    {nota.doBling && (
                      <span className="ml-1.5 rounded-kx-pilula border border-kx-painel-borda px-1.5 py-0.5 text-[10px] font-semibold uppercase text-kx-legenda">
                        Bling
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-2">
                    {nota.clienteNome ?? "—"}
                    {nota.descricaoItens && (
                      <span className="block truncate text-xs text-kx-legenda">{nota.descricaoItens}</span>
                    )}
                  </td>
                  <td className="px-2 py-2 tabular-nums">
                    {/* Travessão, nunca R$ 0,00: o valor não vem na listagem
                        do Bling e chega na sincronização seguinte. Zero aqui
                        somaria errado sem ninguém desconfiar. */}
                    {nota.valorTotal === null ? (
                      <span className="text-kx-legenda" title="Valor ainda não lido do Bling">
                        —
                      </span>
                    ) : (
                      new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
                        nota.valorTotal
                      )
                    )}
                  </td>
                  <td className="px-2 py-2">
                    {/* O rótulo do Bling é mais preciso que os três estados da
                        Konext: "Rejeitada" e "Aguardando recibo" ambas caem em
                        PENDENTE, e saber qual é o que diz o que fazer. */}
                    {nota.situacaoBling !== null
                      ? rotuloDaSituacaoDoBling(nota.situacaoBling)
                      : nota.status}
                  </td>
                  <td className="px-2 py-2 tabular-nums">
                    {nota.dataEmissao
                      ? new Date(nota.dataEmissao).toLocaleDateString("pt-BR", { timeZone: "UTC" })
                      : new Date(nota.criadoEm).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="px-2 py-2">
                    {nota.numeroPedido !== null ? (
                      <a className="underline" href={`/vendas?pedido=${nota.numeroPedido}`}>
                        Pedido {nota.numeroPedido}
                      </a>
                    ) : nota.motivoSemVinculo ? (
                      <span className="text-xs text-kx-legenda" title={nota.motivoSemVinculo}>
                        sem vínculo
                      </span>
                    ) : (
                      <span className="text-kx-legenda">—</span>
                    )}
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex gap-2 text-xs">
                      {nota.linkDanfe && (
                        <a className="underline" href={nota.linkDanfe} target="_blank" rel="noopener noreferrer">
                          DANFE
                        </a>
                      )}
                      {nota.linkXml && (
                        <a className="underline" href={nota.linkXml} target="_blank" rel="noopener noreferrer">
                          XML
                        </a>
                      )}
                      {!nota.linkDanfe && !nota.linkXml && <span className="text-kx-legenda">—</span>}
                    </div>
                  </td>
                  {podeEditar && (
                    <td className="px-2 py-2">
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => preencherFormulario(nota)}
                          className="rounded border border-kx-campo-borda px-2 py-1 text-xs"
                        >
                          Editar
                        </button>
                        {nota.status !== "EMITIDA" ? (
                          <button
                            onClick={() => alterarStatus(nota.id, "EMITIDA")}
                            className="rounded border border-kx-sucesso px-2 py-1 text-xs text-kx-sucesso-texto"
                          >
                            Emitir
                          </button>
                        ) : null}
                        {nota.status !== "CANCELADA" ? (
                          <button
                            onClick={() => alterarStatus(nota.id, "CANCELADA")}
                            className="rounded border border-kx-erro-borda px-2 py-1 text-xs text-kx-erro-texto"
                          >
                            Cancelar
                          </button>
                        ) : null}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {notasFiltradas.length === 0 ? (
                <tr>
                  <td className="px-2 py-4 text-kx-legenda" colSpan={podeEditar ? 8 : 7}>
                    Nenhuma nota fiscal encontrada para os filtros atuais.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
