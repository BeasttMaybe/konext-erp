"use client";

import { useRef, useState } from "react";
import { Camera, CheckCircle2, ImagePlus, Loader2 } from "lucide-react";

import { enviarFotoPeloCelular, type OrdemParaEnvio } from "@/app/actions/foto-pelo-celular";
import { MOMENTOS_DA_FOTO, type MomentoFoto } from "@/lib/dominio/os/fotos";
import { reduzirImagem } from "@/lib/fotos/reduzir-imagem";

/**
 * A tela do celular.
 *
 * Desenhada para uma mão só: botões grandes, uma decisão por vez, e o
 * resultado de cada foto à vista. Quem usa isto está em pé no balcão com o
 * aparelho do cliente na outra mão.
 *
 * O `capture="environment"` no campo é o detalhe que mais muda o uso: faz o
 * Android e o iPhone abrirem a CÂMERA TRASEIRA direto, em vez da galeria.
 * Sem ele, cada foto vira "abrir galeria, procurar, selecionar" — três
 * toques a mais, vezes vinte fotos.
 */

type Envio = {
  id: string;
  nome: string;
  estado: "ENVIANDO" | "PRONTA" | "ERRO";
  erro?: string;
};

export function EnvioPeloCelular({
  slug,
  segredo,
  ordem,
}: {
  slug: string;
  segredo: string;
  ordem: OrdemParaEnvio;
}) {
  const [momento, setMomento] = useState<MomentoFoto>("ENTRADA");
  const [envios, setEnvios] = useState<Envio[]>([]);
  const [totalNaOrdem, setTotalNaOrdem] = useState(ordem.fotosEnviadas);
  const campo = useRef<HTMLInputElement>(null);

  const restantes = Math.max(0, ordem.limiteDeFotos - totalNaOrdem);

  async function mandar(arquivos: FileList) {
    for (const arquivo of Array.from(arquivos)) {
      const id = `${arquivo.name}-${Date.now()}-${Math.random()}`;

      setEnvios((atuais) => [
        { id, nome: arquivo.name, estado: "ENVIANDO" },
        ...atuais,
      ]);

      try {
        // Reduz no aparelho antes de subir. Foto de celular tem 3 a 6 MB e o
        // corpo de uma requisição na Vercel para em 4,5 MB — o arquivo
        // original simplesmente não chegaria. E na rede do balcão, subir 6 MB
        // é o que faz a pessoa achar que travou.
        const reduzida = await reduzirImagem(arquivo);

        const dados = new FormData();
        dados.append("slug", slug);
        dados.append("segredo", segredo);
        dados.append("momento", momento);
        dados.append("arquivo", reduzida.arquivo);
        dados.append("largura", String(reduzida.largura));
        dados.append("altura", String(reduzida.altura));

        const resultado = await enviarFotoPeloCelular(dados);

        if (!resultado.sucesso) {
          setEnvios((atuais) =>
            atuais.map((envio) =>
              envio.id === id ? { ...envio, estado: "ERRO", erro: resultado.erro } : envio
            )
          );
          continue;
        }

        setTotalNaOrdem(resultado.fotosEnviadas);
        setEnvios((atuais) =>
          atuais.map((envio) => (envio.id === id ? { ...envio, estado: "PRONTA" } : envio))
        );
      } catch {
        setEnvios((atuais) =>
          atuais.map((envio) =>
            envio.id === id
              ? { ...envio, estado: "ERRO", erro: "Não consegui preparar esta foto." }
              : envio
          )
        );
      }
    }
  }

  return (
    <main className="min-h-dvh bg-kx-fundo">
      <header className="border-b border-kx-painel-borda bg-kx-painel px-5 py-4">
        <p className="text-xs uppercase tracking-wide text-kx-legenda">{ordem.lojaNome}</p>
        <h1 className="mt-1 text-xl font-semibold text-kx-texto">OS #{ordem.numeroOs}</h1>
        <p className="text-sm text-kx-texto-2">{ordem.aparelho}</p>
      </header>

      <div className="space-y-5 p-5">
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-kx-texto">Estas fotos são de quando?</legend>

          <div className="grid grid-cols-3 gap-2">
            {MOMENTOS_DA_FOTO.map((opcao) => (
              <button
                key={opcao.valor}
                type="button"
                onClick={() => setMomento(opcao.valor)}
                className={
                  momento === opcao.valor
                    ? "rounded-kx-botao bg-kx-primaria px-3 py-3 text-sm font-semibold text-primary-foreground"
                    : "rounded-kx-botao border border-kx-painel-borda px-3 py-3 text-sm font-medium text-kx-texto-2"
                }
              >
                {opcao.rotulo}
              </button>
            ))}
          </div>
        </fieldset>

        <input
          ref={campo}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          // Abre a câmera traseira direto, em vez da galeria.
          capture="environment"
          multiple
          className="sr-only"
          onChange={(evento) => {
            const arquivos = evento.target.files;
            if (arquivos && arquivos.length > 0) void mandar(arquivos);
            evento.target.value = "";
          }}
        />

        {restantes === 0 ? (
          <p className="rounded-kx-cartao bg-kx-alerta-fundo p-kx-4 text-sm text-kx-alerta-texto">
            Esta OS já tem o máximo de {ordem.limiteDeFotos} fotos. Apague alguma pelo sistema
            antes de mandar mais.
          </p>
        ) : (
          <button
            type="button"
            onClick={() => campo.current?.click()}
            className="flex w-full items-center justify-center gap-3 rounded-kx-botao bg-kx-primaria px-5 py-5 text-base font-semibold text-primary-foreground"
          >
            <Camera className="h-6 w-6" aria-hidden />
            Tirar foto
          </button>
        )}

        <p className="text-center text-xs text-kx-legenda">
          {totalNaOrdem} de {ordem.limiteDeFotos} fotos nesta OS
          {restantes > 0 && ` · cabem mais ${restantes}`}
        </p>

        {envios.length > 0 && (
          <ul className="space-y-2">
            {envios.map((envio) => (
              <li
                key={envio.id}
                className="flex items-center gap-3 rounded-kx-cartao border border-kx-painel-borda bg-kx-cartao p-kx-3"
              >
                {envio.estado === "ENVIANDO" && (
                  <Loader2 className="h-5 w-5 shrink-0 animate-spin text-kx-legenda" aria-hidden />
                )}
                {envio.estado === "PRONTA" && (
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-kx-sucesso-icone" aria-hidden />
                )}
                {envio.estado === "ERRO" && (
                  <ImagePlus className="h-5 w-5 shrink-0 text-kx-erro-texto" aria-hidden />
                )}

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-kx-texto">
                    {envio.estado === "ENVIANDO" && "Enviando..."}
                    {envio.estado === "PRONTA" && "Foto enviada"}
                    {envio.estado === "ERRO" && "Não enviou"}
                  </p>
                  {envio.erro && <p className="text-xs text-kx-erro-texto">{envio.erro}</p>}
                </div>
              </li>
            ))}
          </ul>
        )}

        <p className="pt-2 text-center text-xs text-kx-legenda">
          As fotos aparecem na OS automaticamente. Pode fechar esta tela quando terminar.
        </p>
      </div>
    </main>
  );
}
