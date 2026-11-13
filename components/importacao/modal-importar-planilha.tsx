"use client";

import { useRef, useState } from "react";
import { CircleAlert, CircleCheck, Download, FileSpreadsheet, Loader2, Upload } from "lucide-react";

import type { ResultadoDoLote } from "@/app/actions/importacao";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  LIMITE_DE_LINHAS,
  lerCsv,
  modeloCsv,
  registrosDaPlanilha,
  type Coluna,
  type Conversao,
  type Registro,
} from "@/lib/importacao/planilha";

type Linha<T> = { numero: number; resumo: string; conversao: Conversao<T> };

type Etapa<T> =
  | { tipo: "escolher"; erro?: string }
  | { tipo: "conferir"; arquivo: string; linhas: Linha<T>[] }
  | { tipo: "enviando"; feitos: number; total: number }
  | { tipo: "pronto"; criados: number; repetidos: number[]; erros: Array<{ numero: number; mensagem: string }> };

/**
 * Importar uma planilha CSV: escolher o arquivo, conferir linha a linha
 * (o que vai e o que tem problema, com o numero da linha na planilha),
 * enviar em lotes com barra de progresso e mostrar o resultado.
 * As regras do que e valido ficam em lib/importacao/planilha.ts.
 */
export function ModalImportarPlanilha<C extends string, T>({
  aberto,
  onFechar,
  titulo,
  oQue,
  colunas,
  converter,
  resumir,
  enviarLote,
  tamanhoDoLote,
  nomeDoModelo,
  onConcluido,
}: {
  aberto: boolean;
  onFechar: () => void;
  titulo: string;
  /** "clientes", "produtos" — vai nos textos. */
  oQue: string;
  colunas: readonly Coluna<C>[];
  converter: (registro: Registro<C>) => Conversao<T>;
  resumir: (registro: Registro<C>) => string;
  enviarLote: (lote: T[]) => Promise<ResultadoDoLote>;
  tamanhoDoLote: number;
  nomeDoModelo: string;
  onConcluido: (criados: number) => void;
}) {
  const [etapa, setEtapa] = useState<Etapa<T>>({ tipo: "escolher" });
  const entrada = useRef<HTMLInputElement>(null);

  const fechar = () => {
    if (etapa.tipo === "enviando") return;
    if (etapa.tipo === "pronto") onConcluido(etapa.criados);
    setEtapa({ tipo: "escolher" });
    onFechar();
  };

  const baixarModelo = () => {
    const blob = new Blob([modeloCsv(colunas)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = nomeDoModelo;
    link.click();
    URL.revokeObjectURL(url);
  };

  const lerArquivo = async (arquivo: File) => {
    if (arquivo.size > 5 * 1024 * 1024) {
      setEtapa({ tipo: "escolher", erro: "Arquivo maior que 5 MB. Divida a planilha em partes." });
      return;
    }
    let texto = await arquivo.text();
    // Excel antigo salva CSV em Windows-1252: os acentos viram "�". Relê assim.
    if (texto.includes("�")) texto = new TextDecoder("windows-1252").decode(await arquivo.arrayBuffer());
    const { registros, faltando } = registrosDaPlanilha(lerCsv(texto), colunas);
    if (faltando.length > 0) {
      setEtapa({ tipo: "escolher", erro: `Faltam colunas obrigatórias: ${faltando.join(", ")}. Use a planilha-modelo.` });
      return;
    }
    if (registros.length === 0) {
      setEtapa({ tipo: "escolher", erro: "A planilha não tem linhas depois do título." });
      return;
    }
    if (registros.length > LIMITE_DE_LINHAS) {
      setEtapa({ tipo: "escolher", erro: `A planilha tem ${registros.length} linhas; o limite é ${LIMITE_DE_LINHAS} por vez.` });
      return;
    }
    setEtapa({
      tipo: "conferir",
      arquivo: arquivo.name,
      linhas: registros.map(({ numero, registro }) => ({ numero, resumo: resumir(registro), conversao: converter(registro) })),
    });
  };

  const importar = async (linhas: Linha<T>[]) => {
    const validas = linhas.filter((l) => l.conversao.ok) as Array<Linha<T> & { conversao: { ok: true; dados: T } }>;
    const erros: Array<{ numero: number; mensagem: string }> = linhas
      .filter((l) => !l.conversao.ok)
      .map((l) => ({ numero: l.numero, mensagem: (l.conversao as { erro: string }).erro }));
    const repetidos: number[] = [];
    let criados = 0;
    setEtapa({ tipo: "enviando", feitos: 0, total: validas.length });
    for (let inicio = 0; inicio < validas.length; inicio += tamanhoDoLote) {
      const fatia = validas.slice(inicio, inicio + tamanhoDoLote);
      try {
        const resultado = await enviarLote(fatia.map((l) => l.conversao.dados));
        criados += resultado.criados;
        repetidos.push(...resultado.repetidos.map((i) => fatia[i].numero));
        erros.push(...resultado.erros.map((e) => ({ numero: fatia[e.indice].numero, mensagem: e.mensagem })));
      } catch {
        erros.push(...fatia.map((l) => ({ numero: l.numero, mensagem: "Falha de conexão ao enviar este lote." })));
      }
      setEtapa({ tipo: "enviando", feitos: Math.min(inicio + tamanhoDoLote, validas.length), total: validas.length });
    }
    erros.sort((a, b) => a.numero - b.numero);
    setEtapa({ tipo: "pronto", criados, repetidos, erros });
  };

  return (
    <Dialog open={aberto} onOpenChange={(abrir) => !abrir && fechar()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>
            Traga sua lista de {oQue} de uma planilha (Excel ou Google Planilhas, salva como CSV). Nada é gravado antes da
            conferência.
          </DialogDescription>
        </DialogHeader>

        {etapa.tipo === "escolher" && (
          <div className="flex flex-col gap-4">
            <ol className="list-decimal space-y-1 pl-5 text-sm text-kx-texto-2">
              <li>Baixe a planilha-modelo e preencha uma linha por item (pode colar da sua planilha atual).</li>
              <li>
                No Excel: Arquivo → Salvar como → <strong>CSV (separado por vírgulas)</strong>. No Google Planilhas: Arquivo →
                Fazer download → CSV.
              </li>
              <li>Escolha o arquivo abaixo e confira antes de importar.</li>
            </ol>
            <p className="text-xs text-kx-legenda">
              Colunas: {colunas.map((c) => (c.obrigatoria ? `${c.titulo} (obrigatória)` : c.titulo)).join(" · ")}
            </p>
            {etapa.erro && (
              <p role="alert" className="flex items-start gap-2 rounded-kx-botao border border-kx-erro bg-kx-erro-fundo px-3 py-2 text-sm text-kx-erro-texto">
                <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                {etapa.erro}
              </p>
            )}
            <input
              ref={entrada}
              type="file"
              accept=".csv,text/csv,text/plain"
              className="hidden"
              aria-label="Arquivo da planilha"
              onChange={(e) => {
                const arquivo = e.target.files?.[0];
                e.target.value = "";
                if (arquivo) void lerArquivo(arquivo);
              }}
            />
            <DialogFooter className="gap-2 sm:justify-between">
              <Button type="button" variant="outline" onClick={baixarModelo}>
                <Download className="h-4 w-4" />
                Baixar planilha-modelo
              </Button>
              <Button type="button" onClick={() => entrada.current?.click()}>
                <Upload className="h-4 w-4" />
                Escolher arquivo CSV
              </Button>
            </DialogFooter>
          </div>
        )}

        {etapa.tipo === "conferir" &&
          (() => {
            const validas = etapa.linhas.filter((l) => l.conversao.ok).length;
            const comProblema = etapa.linhas.length - validas;
            return (
              <div className="flex min-w-0 flex-col gap-3">
                <p className="flex items-center gap-2 text-sm text-kx-texto">
                  <FileSpreadsheet className="h-4 w-4 shrink-0 text-kx-legenda" aria-hidden />
                  <span className="truncate font-semibold">{etapa.arquivo}</span>
                </p>
                <div className="flex flex-wrap gap-2 text-sm">
                  <span className="rounded-full bg-kx-sucesso-fundo px-3 py-1 font-semibold text-kx-sucesso-texto">{validas} prontas</span>
                  {comProblema > 0 && (
                    <span className="rounded-full bg-kx-erro-fundo px-3 py-1 font-semibold text-kx-erro-texto">{comProblema} com problema</span>
                  )}
                </div>
                <div className="max-h-[45vh] overflow-auto rounded-kx-botao border border-kx-painel-borda">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 bg-kx-superficie text-kx-legenda">
                      <tr>
                        <th className="px-3 py-2 font-semibold">Linha</th>
                        <th className="px-3 py-2 font-semibold">Item</th>
                        <th className="px-3 py-2 font-semibold">Situação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {etapa.linhas.slice(0, 300).map((linha) => (
                        <tr key={linha.numero} className="border-t border-kx-painel-borda">
                          <td className="px-3 py-1.5 tabular-nums text-kx-legenda">{linha.numero}</td>
                          <td className="max-w-[260px] truncate px-3 py-1.5 text-kx-texto">{linha.resumo}</td>
                          <td className="px-3 py-1.5">
                            {linha.conversao.ok ? (
                              <span className="text-kx-sucesso-texto">Pronta</span>
                            ) : (
                              <span className="text-kx-erro-texto">{linha.conversao.erro}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {etapa.linhas.length > 300 && (
                    <p className="border-t border-kx-painel-borda px-3 py-2 text-xs text-kx-legenda">
                      Mostrando 300 de {etapa.linhas.length} linhas.
                    </p>
                  )}
                </div>
                {comProblema > 0 && (
                  <p className="text-xs text-kx-legenda">
                    As linhas com problema ficam de fora. Corrija na planilha e importe de novo depois — o que já entrou é pulado.
                  </p>
                )}
                <DialogFooter className="gap-2">
                  <Button type="button" variant="outline" onClick={() => setEtapa({ tipo: "escolher" })}>
                    Escolher outro arquivo
                  </Button>
                  <Button type="button" disabled={validas === 0} onClick={() => void importar(etapa.linhas)}>
                    Importar {validas} {validas === 1 ? "linha" : "linhas"}
                  </Button>
                </DialogFooter>
              </div>
            );
          })()}

        {etapa.tipo === "enviando" && (
          <div className="flex flex-col items-center gap-3 py-6" role="status">
            <Loader2 className="h-6 w-6 animate-spin text-kx-link" aria-hidden />
            <p className="text-sm text-kx-texto">
              Importando {etapa.feitos} de {etapa.total}… não feche esta janela.
            </p>
            <div className="h-2 w-full max-w-sm overflow-hidden rounded-full bg-kx-superficie" aria-hidden>
              <div className="h-full rounded-full bg-kx-primaria transition-all" style={{ width: `${(etapa.feitos / Math.max(etapa.total, 1)) * 100}%` }} />
            </div>
          </div>
        )}

        {etapa.tipo === "pronto" && (
          <div className="flex flex-col gap-3">
            <p className="flex items-center gap-2 text-sm font-semibold text-kx-sucesso-texto" role="status">
              <CircleCheck className="h-5 w-5" aria-hidden />
              {etapa.criados} {etapa.criados === 1 ? "cadastro criado" : "cadastros criados"}.
            </p>
            {etapa.repetidos.length > 0 && (
              <p className="text-sm text-kx-texto-2">
                {etapa.repetidos.length} já existiam e foram pulados (linhas {etapa.repetidos.slice(0, 20).join(", ")}
                {etapa.repetidos.length > 20 ? "…" : ""}).
              </p>
            )}
            {etapa.erros.length > 0 && (
              <div className="max-h-[35vh] overflow-auto rounded-kx-botao border border-kx-erro bg-kx-erro-fundo px-3 py-2 text-xs text-kx-erro-texto">
                <p className="mb-1 font-semibold">{etapa.erros.length} ficaram de fora:</p>
                <ul className="space-y-0.5">
                  {etapa.erros.slice(0, 200).map((e) => (
                    <li key={`${e.numero}-${e.mensagem}`}>
                      Linha {e.numero}: {e.mensagem}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <DialogFooter>
              <Button type="button" onClick={fechar}>
                Concluir
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
