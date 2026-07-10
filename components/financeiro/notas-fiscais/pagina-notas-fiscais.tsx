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

type Props = {
  notasIniciais: NotaFiscalLista[];
  clientes: Array<{ id: string; nome: string }>;
};

const OPCOES_STATUS: StatusNotaFiscal[] = ["PENDENTE", "EMITIDA", "CANCELADA"];

export function PaginaNotasFiscais({ notasIniciais, clientes }: Props) {
  const [notas, setNotas] = useState<NotaFiscalLista[]>(notasIniciais);
  const [busca, setBusca] = useState("");
  const [status, setStatus] = useState<StatusNotaFiscal | "TODAS">("TODAS");
  const [erro, setErro] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

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

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Notas Fiscais</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Cadastro e consulta de notas fiscais por tenant.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">Filtros</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <input
              value={busca}
              onChange={(event) => setBusca(event.target.value)}
              placeholder="Buscar por numero, chave ou cliente"
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as StatusNotaFiscal | "TODAS")}
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
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
            className="mt-3 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
          >
            Atualizar lista
          </button>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
            {idEdicao ? "Editar nota fiscal" : "Nova nota fiscal"}
          </h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <input
              value={numero}
              onChange={(event) => setNumero(event.target.value)}
              placeholder="Numero"
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
            <input
              value={chaveAcesso}
              onChange={(event) => setChaveAcesso(event.target.value)}
              placeholder="Chave de acesso"
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
            <input
              value={valorTotal}
              onChange={(event) => setValorTotal(event.target.value)}
              type="number"
              min="0"
              step="0.01"
              placeholder="Valor total"
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
            <select
              value={statusFormulario}
              onChange={(event) => setStatusFormulario(event.target.value as StatusNotaFiscal)}
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
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
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 md:col-span-2"
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
              className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {idEdicao ? "Salvar alteracoes" : "Criar nota"}
            </button>
            {idEdicao ? (
              <button
                onClick={limparFormulario}
                className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium dark:border-zinc-700"
              >
                Cancelar edicao
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {erro ? (
        <div className="rounded-md border border-red-500/40 bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">
          {erro}
        </div>
      ) : null}
      {mensagem ? (
        <div className="rounded-md border border-emerald-500/40 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
          {mensagem}
        </div>
      ) : null}

      <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">Lista de notas fiscais</h2>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] table-auto border-collapse text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left dark:border-zinc-800">
                <th className="px-2 py-2">Numero</th>
                <th className="px-2 py-2">Cliente</th>
                <th className="px-2 py-2">Valor</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2">Criado em</th>
                <th className="px-2 py-2">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {notasFiltradas.map((nota) => (
                <tr key={nota.id} className="border-b border-zinc-100 dark:border-zinc-900">
                  <td className="px-2 py-2 font-medium">{nota.numero}</td>
                  <td className="px-2 py-2">{nota.clienteNome ?? "-"}</td>
                  <td className="px-2 py-2">
                    {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
                      nota.valorTotal
                    )}
                  </td>
                  <td className="px-2 py-2">{nota.status}</td>
                  <td className="px-2 py-2">{new Date(nota.criadoEm).toLocaleDateString("pt-BR")}</td>
                  <td className="px-2 py-2">
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => preencherFormulario(nota)}
                        className="rounded border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700"
                      >
                        Editar
                      </button>
                      {nota.status !== "EMITIDA" ? (
                        <button
                          onClick={() => alterarStatus(nota.id, "EMITIDA")}
                          className="rounded border border-emerald-700 px-2 py-1 text-xs text-emerald-700"
                        >
                          Emitir
                        </button>
                      ) : null}
                      {nota.status !== "CANCELADA" ? (
                        <button
                          onClick={() => alterarStatus(nota.id, "CANCELADA")}
                          className="rounded border border-red-700 px-2 py-1 text-xs text-red-700"
                        >
                          Cancelar
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
              {notasFiltradas.length === 0 ? (
                <tr>
                  <td className="px-2 py-4 text-zinc-500" colSpan={6}>
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
