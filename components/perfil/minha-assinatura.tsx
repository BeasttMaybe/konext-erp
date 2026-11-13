"use client";

import { useEffect, useRef, useState } from "react";
import { Eraser, Loader2, PenLine, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { obterMinhaAssinatura, removerMinhaAssinatura, salvarMinhaAssinatura } from "@/app/actions/assinatura";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TAMANHO_MAXIMO_DA_ASSINATURA } from "@/lib/dominio/usuarios/assinatura";

/**
 * "Minha assinatura" no Meu Perfil: desenhar com o dedo ou o mouse, ou enviar
 * uma imagem. A assinatura sai pronta na OS (tecnico principal), no termo de
 * garantia e na proposta (quem gera o PDF).
 *
 * O desenho e gravado como PNG com FUNDO TRANSPARENTE e recortado no que foi
 * desenhado: assim ele assenta sobre a linha de assinatura de qualquer
 * documento, sem um retangulo branco em volta.
 */
export function MinhaAssinatura() {
  const [atual, setAtual] = useState<string | null | undefined>(undefined);
  const [desenhando, setDesenhando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const entradaDeArquivo = useRef<HTMLInputElement>(null);

  useEffect(() => {
    obterMinhaAssinatura().then((resultado) => setAtual(resultado.sucesso ? resultado.url : null));
  }, []);

  const enviar = async (arquivo: Blob, nome: string) => {
    setSalvando(true);
    try {
      const dados = new FormData();
      dados.set("arquivo", new File([arquivo], nome, { type: arquivo.type || "image/png" }));
      const resultado = await salvarMinhaAssinatura(dados);
      if (!resultado.sucesso) {
        toast.error(resultado.erro);
        return;
      }
      setAtual(resultado.url);
      setDesenhando(false);
      toast.success("Assinatura salva. Ela já sai nos próximos documentos.");
    } finally {
      setSalvando(false);
    }
  };

  const escolherArquivo = async (arquivo: File | undefined) => {
    if (!arquivo) return;
    try {
      const reduzida = await reduzirImagem(arquivo);
      if (reduzida.size > TAMANHO_MAXIMO_DA_ASSINATURA) {
        toast.error("A imagem continua grande demais. Recorte só a assinatura e tente de novo.");
        return;
      }
      await enviar(reduzida, "assinatura.png");
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Não foi possível abrir a imagem.");
    } finally {
      if (entradaDeArquivo.current) entradaDeArquivo.current.value = "";
    }
  };

  const remover = async () => {
    setSalvando(true);
    try {
      const resultado = await removerMinhaAssinatura();
      if (!resultado.sucesso) {
        toast.error(resultado.erro);
        return;
      }
      setAtual(null);
      toast.success("Assinatura removida. A linha volta a sair em branco.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Card className="space-y-4 border-border bg-card p-4 sm:p-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Minha assinatura</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Sai já assinada nas OS em que você é o técnico principal, no termo de garantia e nas propostas que você gerar.
        </p>
      </div>

      {desenhando ? (
        <QuadroDeAssinatura
          salvando={salvando}
          onCancelar={() => setDesenhando(false)}
          onPronto={(png) => void enviar(png, "assinatura.png")}
        />
      ) : (
        <>
          <div className="flex h-32 items-center justify-center rounded-kx-botao border border-dashed border-kx-campo-borda bg-kx-papel p-3">
            {atual === undefined ? (
              <Loader2 className="h-5 w-5 animate-spin text-kx-papel-legenda" aria-hidden />
            ) : atual ? (
              // eslint-disable-next-line @next/next/no-img-element -- imagem servida pelo proprio sistema (/assinatura).
              <img src={atual} alt="Sua assinatura" className="max-h-full max-w-full object-contain" />
            ) : (
              <span className="text-sm text-kx-papel-legenda">Nenhuma assinatura cadastrada</span>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => setDesenhando(true)} disabled={salvando}>
              <PenLine className="h-4 w-4" />
              {atual ? "Assinar de novo" : "Assinar na tela"}
            </Button>
            <Button type="button" variant="outline" onClick={() => entradaDeArquivo.current?.click()} disabled={salvando}>
              {salvando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Upload className="h-4 w-4" />}
              Enviar imagem
            </Button>
            {atual ? (
              <Button
                type="button"
                variant="outline"
                className="border-kx-erro-borda text-kx-erro-texto hover:bg-kx-erro-fundo"
                onClick={() => void remover()}
                disabled={salvando}
              >
                <Trash2 className="h-4 w-4" />
                Remover
              </Button>
            ) : null}
          </div>
          <input
            ref={entradaDeArquivo}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            hidden
            onChange={(evento) => void escolherArquivo(evento.target.files?.[0])}
          />
        </>
      )}
    </Card>
  );
}

/**
 * Tinta da assinatura: a cor do texto do papel (quase preta, como caneta), lida
 * do token na hora — o canvas nao entende `var(--...)`.
 */
function corDaTinta(): string {
  return getComputedStyle(document.documentElement).getPropertyValue("--kx-papel-texto").trim() || "black";
}

function QuadroDeAssinatura({
  salvando,
  onCancelar,
  onPronto,
}: {
  salvando: boolean;
  onCancelar: () => void;
  onPronto: (png: Blob) => void;
}) {
  const tela = useRef<HTMLCanvasElement>(null);
  const traco = useRef<{ x: number; y: number } | null>(null);
  const [vazio, setVazio] = useState(true);

  // Tamanho real em pixels = tamanho na tela x densidade do aparelho: sem
  // isso o traco sai serrilhado no celular.
  useEffect(() => {
    const canvas = tela.current;
    if (!canvas) return;
    const densidade = window.devicePixelRatio || 1;
    const { width, height } = canvas.getBoundingClientRect();
    canvas.width = Math.round(width * densidade);
    canvas.height = Math.round(height * densidade);
    const pincel = canvas.getContext("2d");
    if (!pincel) return;
    pincel.scale(densidade, densidade);
    pincel.lineCap = "round";
    pincel.lineJoin = "round";
    pincel.lineWidth = 2.6;
    pincel.strokeStyle = corDaTinta();
  }, []);

  const ponto = (evento: React.PointerEvent<HTMLCanvasElement>) => {
    const caixa = evento.currentTarget.getBoundingClientRect();
    return { x: evento.clientX - caixa.left, y: evento.clientY - caixa.top };
  };

  const comecar = (evento: React.PointerEvent<HTMLCanvasElement>) => {
    evento.currentTarget.setPointerCapture(evento.pointerId);
    traco.current = ponto(evento);
    const pincel = evento.currentTarget.getContext("2d");
    if (!pincel) return;
    // Um toque sem arrastar ainda marca um ponto (o pingo do "i").
    pincel.beginPath();
    pincel.arc(traco.current.x, traco.current.y, 1.3, 0, Math.PI * 2);
    pincel.fillStyle = corDaTinta();
    pincel.fill();
    setVazio(false);
  };

  const mover = (evento: React.PointerEvent<HTMLCanvasElement>) => {
    if (!traco.current) return;
    const pincel = evento.currentTarget.getContext("2d");
    if (!pincel) return;
    const novo = ponto(evento);
    pincel.beginPath();
    pincel.moveTo(traco.current.x, traco.current.y);
    pincel.lineTo(novo.x, novo.y);
    pincel.stroke();
    traco.current = novo;
  };

  const parar = () => {
    traco.current = null;
  };

  const limpar = () => {
    const canvas = tela.current;
    canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    setVazio(true);
  };

  const concluir = async () => {
    const canvas = tela.current;
    if (!canvas) return;
    const recortada = recortarDesenho(canvas);
    if (!recortada) {
      toast.error("Assine dentro do quadro antes de salvar.");
      return;
    }
    const png = await new Promise<Blob | null>((resolver) => recortada.toBlob(resolver, "image/png"));
    if (png) onPronto(png);
  };

  return (
    <div className="space-y-3">
      <div className="relative rounded-kx-botao border border-kx-campo-borda bg-kx-papel">
        {/* touch-none: sem isso, arrastar o dedo rola a pagina em vez de assinar. */}
        <canvas
          ref={tela}
          aria-label="Quadro para assinar com o dedo ou o mouse"
          className="block h-44 w-full touch-none cursor-crosshair"
          onPointerDown={comecar}
          onPointerMove={mover}
          onPointerUp={parar}
          onPointerCancel={parar}
          onPointerLeave={parar}
        />
        <div aria-hidden className="pointer-events-none absolute inset-x-6 bottom-9 border-b border-kx-papel-borda-forte" />
        {vazio ? (
          <span className="pointer-events-none absolute inset-x-0 top-4 text-center text-sm text-kx-papel-legenda">
            Assine aqui
          </span>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => void concluir()} disabled={vazio || salvando}>
          {salvando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          Salvar assinatura
        </Button>
        <Button type="button" variant="outline" onClick={limpar} disabled={vazio || salvando}>
          <Eraser className="h-4 w-4" />
          Limpar
        </Button>
        <Button type="button" variant="ghost" onClick={onCancelar} disabled={salvando}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}

/** Recorta o canvas no que foi desenhado (com respiro), mantendo o fundo transparente. */
function recortarDesenho(canvas: HTMLCanvasElement): HTMLCanvasElement | null {
  const pincel = canvas.getContext("2d");
  if (!pincel) return null;
  const { width, height } = canvas;
  const pixels = pincel.getImageData(0, 0, width, height).data;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (pixels[(y * width + x) * 4 + 3] > 0) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  const respiro = Math.round(8 * (window.devicePixelRatio || 1));
  minX = Math.max(0, minX - respiro);
  minY = Math.max(0, minY - respiro);
  maxX = Math.min(width - 1, maxX + respiro);
  maxY = Math.min(height - 1, maxY + respiro);
  const saida = document.createElement("canvas");
  saida.width = maxX - minX + 1;
  saida.height = maxY - minY + 1;
  saida.getContext("2d")?.drawImage(canvas, minX, minY, saida.width, saida.height, 0, 0, saida.width, saida.height);
  return saida;
}

/** Imagem enviada: no maximo 900px de largura, em PNG (mantem transparencia). */
async function reduzirImagem(arquivo: File): Promise<Blob> {
  if (!["image/png", "image/jpeg", "image/webp"].includes(arquivo.type)) {
    throw new Error("Envie a assinatura em PNG, JPG ou WEBP.");
  }
  const endereco = URL.createObjectURL(arquivo);
  try {
    const imagem = await new Promise<HTMLImageElement>((resolver, rejeitar) => {
      const img = new Image();
      img.onload = () => resolver(img);
      img.onerror = () => rejeitar(new Error("Não foi possível abrir a imagem."));
      img.src = endereco;
    });
    const escala = Math.min(1, 900 / imagem.naturalWidth);
    if (escala === 1 && arquivo.size <= TAMANHO_MAXIMO_DA_ASSINATURA) return arquivo;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(imagem.naturalWidth * escala);
    canvas.height = Math.round(imagem.naturalHeight * escala);
    canvas.getContext("2d")?.drawImage(imagem, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolver) => canvas.toBlob(resolver, "image/png"));
    if (!blob) throw new Error("Não foi possível preparar a imagem.");
    return blob;
  } finally {
    URL.revokeObjectURL(endereco);
  }
}
