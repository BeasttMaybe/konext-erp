"use client";

import { useRef, useState } from "react";
import { FileCode2, FileText, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * O primeiro passo: o arquivo.
 *
 * Aceita XML e PDF pela mesma porta de propósito. Quem recebe nota de
 * fornecedor não pensa "isto é um XML estruturado, aquilo é um PDF" — pensa
 * "chegou a nota da EA Central". Obrigar a escolher o tipo antes de soltar o
 * arquivo é fazer a pessoa classificar o que o sistema consegue ver sozinho.
 *
 * A diferença entre os dois aparece DEPOIS, na conferência, que é onde ela
 * tem consequência.
 */
export function SoltarArquivo({
  onEscolher,
  carregando,
}: {
  onEscolher: (arquivo: File) => void;
  carregando: boolean;
}) {
  const [arrastando, setArrastando] = useState(false);
  const campo = useRef<HTMLInputElement>(null);

  return (
    <div
      onDragOver={(evento) => {
        evento.preventDefault();
        setArrastando(true);
      }}
      onDragLeave={() => setArrastando(false)}
      onDrop={(evento) => {
        evento.preventDefault();
        setArrastando(false);

        const arquivo = evento.dataTransfer.files?.[0];
        if (arquivo && !carregando) onEscolher(arquivo);
      }}
      className={`flex flex-col items-center gap-4 rounded-kx-painel border-2 border-dashed p-kx-8 text-center transition-colors ${
        arrastando
          ? "border-kx-primaria bg-kx-info-fundo"
          : "border-kx-painel-borda bg-kx-cartao"
      }`}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-kx-cartao bg-muted text-kx-texto-2">
        <Upload className="h-6 w-6" aria-hidden />
      </div>

      <div className="space-y-1">
        <p className="text-base font-semibold text-kx-texto">
          Arraste a nota do fornecedor aqui
        </p>
        <p className="text-sm text-kx-legenda">
          Ou escolha o arquivo. O sistema lê os itens e mostra tudo pra você conferir antes de
          mexer no estoque.
        </p>
      </div>

      <input
        ref={campo}
        type="file"
        accept=".xml,.pdf,text/xml,application/xml,application/pdf"
        className="sr-only"
        onChange={(evento) => {
          const arquivo = evento.target.files?.[0];
          if (arquivo) onEscolher(arquivo);
          // Zera pra que escolher o MESMO arquivo de novo dispare o evento:
          // é o que acontece quando a pessoa corrige o arquivo e reenvia.
          evento.target.value = "";
        }}
      />

      <Button type="button" onClick={() => campo.current?.click()} disabled={carregando}>
        {carregando ? "Lendo o arquivo..." : "Escolher arquivo"}
      </Button>

      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-kx-legenda">
        <span className="inline-flex items-center gap-1.5">
          <FileCode2 className="h-3.5 w-3.5" aria-hidden />
          XML da NF-e — leitura exata
        </span>
        <span className="inline-flex items-center gap-1.5">
          <FileText className="h-3.5 w-3.5" aria-hidden />
          PDF de orçamento ou pedido — leitura conferida pela conta
        </span>
      </div>
    </div>
  );
}
