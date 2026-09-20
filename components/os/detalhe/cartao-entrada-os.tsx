type PropsCartaoEntradaOS = {
  relatoCliente: string;
  condicaoFisica: string;
  acessorios: string;
};

/** Checklist de entrada — relato do cliente, condição física, acessórios (referência: docs/design/referencia-os-detalhe.html). */
export function CartaoEntradaOS({ relatoCliente, condicaoFisica, acessorios }: PropsCartaoEntradaOS) {
  return (
    <div className="p-kx-4 rounded-kx-painel border border-kx-painel-borda bg-kx-painel flex flex-1 flex-col gap-3 overflow-hidden">
      <span className="text-sm font-bold text-kx-texto">Entrada</span>
      <div className="flex flex-col gap-1">
        <span className="text-xs text-kx-legenda">Relato do cliente</span>
        <span className="text-sm leading-relaxed text-kx-texto whitespace-pre-wrap">{relatoCliente}</span>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs text-kx-legenda">Condição física</span>
        <span className="text-sm text-kx-texto whitespace-pre-wrap">{condicaoFisica || "Não informada"}</span>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs text-kx-legenda">Acessórios deixados</span>
        <span className="text-sm text-kx-legenda whitespace-pre-wrap">{acessorios || "Nenhum"}</span>
      </div>
    </div>
  );
}
