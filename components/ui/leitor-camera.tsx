"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, X } from "lucide-react";
// So o TIPO: a biblioteca em si e carregada por import() quando o leitor abre.
import type { DecodeHintType as TipoDeDica } from "@zxing/library";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { mensagemDeErroDaCamera } from "@/lib/dispositivo/camera";

/**
 * Leitor de codigo pela camera do celular: codigo de barras das etiquetas
 * (EAN-13, EAN-8, Code128) e QR code.
 *
 * POR QUE `@zxing/browser` E NAO A API DO NAVEGADOR
 *
 * O Chrome tem `BarcodeDetector`, que leria sem biblioteca nenhuma — mas o
 * Safari do iPhone NAO tem, e o iPhone e o aparelho do dono. A biblioteca e
 * carregada so quando o leitor abre (`import()` dinamico): quem nunca toca
 * no botao da camera nao baixa nada.
 *
 * MONTAGEM SO QUANDO ABERTO
 *
 * O componente que faz o trabalho (`AreaDoLeitor`) so existe enquanto o
 * dialogo esta aberto. Fechar desmonta, e desmontar DESLIGA a camera — a luz
 * verde do iPhone apaga no mesmo instante. Camera esquecida ligada em
 * segundo plano e o tipo de coisa que faz uma pessoa desconfiar do sistema.
 */
export function LeitorCamera({
  aberto,
  onFechar,
  onLido,
  titulo,
  instrucao,
  continuo = false,
}: {
  aberto: boolean;
  onFechar: () => void;
  /** Texto lido. No modo unico o leitor fecha sozinho logo depois. */
  onLido: (texto: string) => void;
  titulo: string;
  instrucao: string;
  /**
   * Continua lendo depois de cada codigo — o PDV, onde se bipa um item
   * atras do outro. O mesmo codigo so conta de novo depois de uma pausa,
   * senao o mesmo produto entraria varias vezes enquanto a camera ainda o ve.
   */
  continuo?: boolean;
}) {
  return (
    <Dialog open={aberto} onOpenChange={(abrir) => !abrir && onFechar()}>
      <DialogContent className="gap-4 p-4 sm:max-w-md">
        <div className="pr-8">
          <DialogTitle className="text-base font-bold text-kx-texto">{titulo}</DialogTitle>
          <DialogDescription className="mt-1 text-sm text-kx-legenda">{instrucao}</DialogDescription>
        </div>
        {aberto ? (
          <AreaDoLeitor
            continuo={continuo}
            onLido={(texto) => {
              onLido(texto);
              if (!continuo) onFechar();
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

/** Intervalo minimo para o MESMO codigo contar de novo no modo continuo. */
const PAUSA_PARA_REPETIR_MS = 1500;

function AreaDoLeitor({ continuo, onLido }: { continuo: boolean; onLido: (texto: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ultimoLido, setUltimoLido] = useState<string | null>(null);

  // O callback muda a cada renderizacao do pai; a camera nao pode reiniciar
  // por causa disso. Guarda-se a versao mais recente numa ref.
  const aoLer = useRef(onLido);
  useEffect(() => {
    aoLer.current = onLido;
  }, [onLido]);

  useEffect(() => {
    let cancelado = false;
    let parar: (() => void) | null = null;
    const recente = { texto: "", em: 0 };

    (async () => {
      try {
        if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
          throw Object.assign(new Error("camera indisponivel"), { name: "ContextoInseguro" });
        }

        const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
          import("@zxing/browser"),
          import("@zxing/library"),
        ]);
        if (cancelado || !video.current) return;

        const dicas = new Map<TipoDeDica, unknown>([
          // So os formatos que o sistema imprime: ler menos formatos e mais
          // rapido e erra menos.
          [
            DecodeHintType.POSSIBLE_FORMATS,
            [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.CODE_128, BarcodeFormat.QR_CODE],
          ],
          [DecodeHintType.TRY_HARDER, true],
        ]);

        const leitor = new BrowserMultiFormatReader(dicas, { delayBetweenScanAttempts: 120 });
        const controles = await leitor.decodeFromConstraints(
          { audio: false, video: { facingMode: { ideal: "environment" } } },
          video.current,
          // Os controles da camera chegam como TERCEIRO argumento, e e
          // deles que se usa aqui — nao da variavel `controles` abaixo. O
          // primeiro codigo pode ser lido ANTES de `decodeFromConstraints`
          // terminar, e nesse instante a variavel ainda nao existe: chamar
          // `controles.stop()` lancava um erro que a biblioteca engolia, e no
          // modo de leitura unica o QR era lido e a OS nunca abria.
          (resultado, _erro, controlesDaLeitura) => {
            if (!resultado) return;
            const texto = resultado.getText().trim();
            if (!texto) return;

            const agora = Date.now();
            if (texto === recente.texto && agora - recente.em < PAUSA_PARA_REPETIR_MS) return;
            recente.texto = texto;
            recente.em = agora;

            setUltimoLido(texto);
            if (!continuo) controlesDaLeitura.stop();
            aoLer.current(texto);
          }
        );

        if (cancelado) controles.stop();
        else parar = () => controles.stop();
      } catch (falha) {
        if (!cancelado) setErro(mensagemDeErroDaCamera(falha));
      }
    })();

    return () => {
      cancelado = true;
      parar?.();
    };
  }, [continuo]);

  if (erro) {
    return (
      <div role="alert" className="flex flex-col items-center gap-3 rounded-kx-painel border border-kx-alerta bg-kx-alerta-fundo px-4 py-6 text-center">
        <X className="h-6 w-6 text-kx-alerta-texto" aria-hidden />
        <p className="text-sm text-kx-alerta-texto">{erro}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-kx-painel bg-kx-fora sm:aspect-video">
        {/* playsInline + muted: sem os dois, o iPhone abre o video em tela
            cheia por cima do sistema em vez de mostrar dentro do quadro. */}
        <video ref={video} className="h-full w-full object-cover" playsInline muted autoPlay />
        {/* Mira: so orientacao visual, a leitura usa o quadro inteiro. */}
        <div aria-hidden className="pointer-events-none absolute inset-x-8 top-1/2 h-28 -translate-y-1/2 rounded-kx-painel border-2 border-kx-destaque/80" />
      </div>
      <p className="flex items-center justify-center gap-2 text-sm text-kx-legenda" aria-live="polite">
        <Camera className="h-4 w-4" aria-hidden />
        {ultimoLido ? `Lido: ${ultimoLido}` : "Procurando código…"}
      </p>
    </div>
  );
}
