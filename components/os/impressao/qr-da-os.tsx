/**
 * O QR code impresso na OS: o tecnico aponta o celular e a OS abre.
 *
 * O SVG vem pronto do servidor (`gerarQrCodeSvg`, mesma biblioteca das
 * etiquetas), gerado a partir de um endereco que o proprio sistema monta —
 * nenhum texto de usuario passa por ele, por isso pode ser inserido como
 * marcacao.
 */
export function QrDaOS({ svg, tamanho, legenda }: { svg: string | null; tamanho: string; legenda?: string }) {
  if (!svg) return null;

  return (
    <figure className="inline-flex flex-col items-center gap-1">
      <div
        className="bg-kx-papel [&>svg]:h-auto [&>svg]:w-full"
        style={{ width: tamanho }}
        role="img"
        aria-label="QR code para abrir esta OS no celular"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      {legenda ? <figcaption className="text-[9px] leading-tight text-kx-papel-legenda">{legenda}</figcaption> : null}
    </figure>
  );
}
