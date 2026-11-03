"use client";

import { useEffect, useState } from "react";
import { Printer, Tag } from "lucide-react";

import { gerarPreviaEtiqueta, type PreviaEtiqueta } from "@/app/actions/estoque";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PALETA_PAPEL } from "@/lib/design/papel";
import {
  TAMANHOS_DE_ETIQUETA,
  TAMANHO_DE_ETIQUETA_PADRAO,
  acharTamanhoDeEtiqueta,
  encurtarParaEtiqueta,
  limiteDeNomePorTamanho,
} from "@/lib/dominio/estoque/etiqueta";

/**
 * Prévia e impressão da etiqueta.
 *
 * A prévia mostra o código de barras DE VERDADE, gerado pela especificação da
 * simbologia — não um desenho. Isso importa porque é aqui que o dono descobre,
 * antes de gastar rolo, que o código de barras digitado tem um dígito trocado:
 * o gerador recusa, e a mensagem aparece no lugar da prévia.
 *
 * A prévia acompanha o que está DIGITADO, não o que está salvo. Trocar o código
 * e só ver o resultado depois de salvar transformaria "confira antes de
 * imprimir" em "salve e descubra".
 */
export function PainelEtiqueta({
  produtoId,
  nome,
  precoFormatado,
  codigoBarras,
  sku,
  compatibilidade,
}: {
  /** `null` enquanto o produto não foi salvo: não há o que imprimir ainda. */
  produtoId: string | null;
  nome: string;
  precoFormatado: string;
  codigoBarras: string;
  sku: string;
  compatibilidade: string;
}) {
  const [previa, setPrevia] = useState<PreviaEtiqueta | null>(null);
  const [tamanhoId, setTamanhoId] = useState(TAMANHO_DE_ETIQUETA_PADRAO);
  const [copias, setCopias] = useState("1");

  const tamanho = acharTamanhoDeEtiqueta(tamanhoId);

  // Espera a digitação parar: cada tecla no campo de código de barras dispararia
  // uma geração no servidor.
  useEffect(() => {
    let ativo = true;
    const temporizador = setTimeout(() => {
      void (async () => {
        const resultado = await gerarPreviaEtiqueta({
          codigoBarras: codigoBarras.trim() || null,
          sku: sku.trim() || null,
        });
        if (ativo) setPrevia(resultado);
      })();
    }, 400);

    return () => {
      ativo = false;
      clearTimeout(temporizador);
    };
  }, [codigoBarras, sku]);

  const nomeNaEtiqueta = encurtarParaEtiqueta(
    nome || "Produto sem nome",
    limiteDeNomePorTamanho(tamanho)
  );

  const copiasNumero = Math.max(1, Math.min(100, Number.parseInt(copias, 10) || 1));
  const podeImprimir = produtoId !== null && previa?.ok === true;

  return (
    <div className="rounded-kx-painel border border-kx-painel-borda bg-kx-painel p-5">
      <div className="flex items-center gap-2">
        <Tag className="h-4 w-4 text-kx-legenda" aria-hidden />
        <h2 className="text-base font-semibold text-kx-texto">Etiqueta</h2>
      </div>

      {/* A etiqueta é impressa em papel branco, sempre — por isso as cores aqui
          vêm de PALETA_PAPEL e não dos tokens de tela. A prévia tem que parecer
          com o que sai da impressora, não com o tema do app. */}
      <div className="mt-4 flex justify-center rounded-kx-botao bg-kx-superficie p-4">
        <div
          className="flex w-[210px] flex-col gap-1.5 rounded-md p-3"
          style={{ backgroundColor: PALETA_PAPEL.papel, color: PALETA_PAPEL.texto }}
        >
          {tamanho.larguraMm > 35 && (
            <span className="text-[11px] font-bold leading-tight">{nomeNaEtiqueta}</span>
          )}

          {tamanho.larguraMm >= 60 && compatibilidade.trim() && (
            <span className="text-[10px]" style={{ color: PALETA_PAPEL.texto2 }}>
              {encurtarParaEtiqueta(compatibilidade, 44)}
            </span>
          )}

          <span className="text-lg font-extrabold leading-none">{precoFormatado}</span>

          {previa === null ? (
            <div className="h-[46px] animate-pulse rounded bg-kx-superficie" />
          ) : previa.ok ? (
            <div className="flex flex-col items-center gap-0.5">
              {/* O SVG vem do gerador no servidor. É conteúdo que ESTE código
                  acabou de pedir, com o texto do próprio formulário — não vem
                  do banco nem de terceiros. */}
              <div
                className="w-full [&_svg]:h-[34px] [&_svg]:w-full"
                dangerouslySetInnerHTML={{ __html: previa.svg }}
              />
              <span
                className="text-[9px] tabular-nums tracking-wider"
                style={{ color: PALETA_PAPEL.texto2 }}
              >
                {previa.legenda}
              </span>
            </div>
          ) : (
            <p className="text-[10px] leading-snug" style={{ color: PALETA_PAPEL.texto2 }}>
              {previa.erro}
            </p>
          )}
        </div>
      </div>

      {previa?.ok && previa.origem === "SKU" && (
        <p className="mt-3 text-xs text-kx-legenda">
          A etiqueta está usando o SKU. Cadastre o código de barras da embalagem para poder bipar
          o produto original.
        </p>
      )}

      {previa !== null && !previa.ok && (
        <p className="mt-3 text-xs font-semibold text-kx-alerta-texto">{previa.erro}</p>
      )}

      <div className="mt-4 space-y-3">
        <div className="space-y-1.5">
          <Label>Tamanho do rolo</Label>
          <div className="flex gap-2">
            {TAMANHOS_DE_ETIQUETA.map((opcao) => (
              <button
                key={opcao.id}
                type="button"
                aria-pressed={opcao.id === tamanhoId}
                title={opcao.ajuda}
                onClick={() => setTamanhoId(opcao.id)}
                className={
                  opcao.id === tamanhoId
                    ? "flex-1 rounded-kx-botao border border-kx-primaria bg-kx-primaria px-2 py-2 text-xs font-bold text-primary-foreground"
                    : "flex-1 rounded-kx-botao border border-kx-campo-borda px-2 py-2 text-xs font-semibold text-kx-texto-2 hover:text-kx-texto"
                }
              >
                {opcao.rotulo}
              </button>
            ))}
          </div>
          <p className="text-xs text-kx-legenda">{tamanho.ajuda}</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="copias-etiqueta">Quantas etiquetas</Label>
          <Input
            id="copias-etiqueta"
            type="number"
            min={1}
            max={100}
            value={copias}
            onChange={(evento) => setCopias(evento.target.value)}
          />
        </div>

        <Button asChild={podeImprimir} className="w-full" disabled={!podeImprimir}>
          {podeImprimir ? (
            <a
              href={`/estoque/produtos/${produtoId}/etiqueta?tamanho=${tamanhoId}&copias=${copiasNumero}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Printer className="h-4 w-4" />
              Imprimir etiqueta
            </a>
          ) : (
            <span>
              <Printer className="h-4 w-4" />
              Imprimir etiqueta
            </span>
          )}
        </Button>

        <p className="text-xs text-kx-legenda">
          {produtoId === null
            ? "Salve o produto para poder imprimir."
            : "Abre um PDF no tamanho exato da etiqueta, uma por página."}
        </p>
      </div>
    </div>
  );
}
