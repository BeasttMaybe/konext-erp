import type { DadosTermoGarantia } from "@/app/actions/garantias";

type TermoGarantiaDocumentoProps = {
  termo: DadosTermoGarantia;
};

const tituloDocumento = "Termo de Garantia";

function formatarData(dataIso: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(dataIso));
}

function formatarMoeda(valor: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valor);
}

export function TermoGarantiaDocumento({ termo }: TermoGarantiaDocumentoProps) {
  const marcaModelo = termo.marcaModelo?.trim() || "Nao informado";
  const imeiSerie = termo.imeiOuSerial?.trim() || "Nao informado";
  const diagnostico = termo.diagnosticoTecnico?.trim() || "Nao informado";
  const nomeEmpresa = termo.empresa.nome?.trim() || "Empresa não configurada";
  const documentoEmpresa = termo.empresa.documento?.trim() || "CNPJ não informado";
  const telefoneEmpresa = termo.empresa.telefone?.trim() || "Telefone não informado";
  const enderecoEmpresa = termo.empresa.endereco?.trim() || "Endereço não informado";
  const logoUrl = termo.empresa.logoUrl?.trim() || "";

  return (
    <div className="space-y-5 text-[11px] leading-[1.45] text-kx-papel-texto">
      <header className="border-b border-kx-papel-borda pb-4">
        <div className="flex items-start justify-between gap-6">
          <div className="flex max-w-[70%] items-start gap-4">
            <div className="flex h-20 w-40 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-kx-papel-borda bg-kx-papel">
              {logoUrl ? (
                <img src={logoUrl} alt={`Logo ${nomeEmpresa}`} className="h-full w-full object-contain p-1" />
              ) : (
                <span className="px-2 text-center text-[10px] font-medium text-kx-papel-legenda">Logo não configurada</span>
              )}
            </div>

            <div>
              <p className="text-[28px] font-black leading-none tracking-tight text-kx-papel-texto">{nomeEmpresa}</p>
              <p className="mt-1 text-[11px] text-kx-papel-texto-2">Documento: {documentoEmpresa}</p>
              <p className="text-[11px] text-kx-papel-texto-2">Telefone: {telefoneEmpresa}</p>
              <p className="text-[11px] text-kx-papel-texto-2">Endereco: {enderecoEmpresa}</p>
            </div>
          </div>

          <div className="text-right">
            <p className="text-[16px] font-bold uppercase tracking-[0.08em] text-kx-papel-texto">{tituloDocumento}</p>
            <p className="mt-1 text-[11px] text-kx-papel-texto-2">OS: {termo.numeroOS}</p>
          </div>
        </div>

        <div className="mt-3 h-[2px] bg-kx-papel-alternado" />
      </header>

      <section className="grid grid-cols-2 gap-4 break-inside-avoid border border-kx-papel-borda p-3">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-kx-papel-legenda">Data de finalizacao</p>
          <p className="mt-1 text-[12px] font-semibold text-kx-papel-texto">{formatarData(termo.dataFinalizacao)}</p>
        </div>
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-kx-papel-legenda">Prazo da garantia</p>
          <p className="mt-1 text-[12px] font-semibold text-kx-papel-texto">{termo.prazoGarantiaDias} dias</p>
        </div>
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-kx-papel-legenda">Data final da garantia</p>
          <p className="mt-1 text-[12px] font-semibold text-kx-papel-texto">{formatarData(termo.dataFimGarantia)}</p>
        </div>
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-kx-papel-legenda">Valor cobrado</p>
          <p className="mt-1 text-[12px] font-semibold text-kx-papel-texto">{formatarMoeda(termo.valorCobrado)}</p>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-5 break-inside-avoid border-b border-kx-papel-borda pb-4">
        <div className="space-y-2">
          <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-kx-papel-legenda">Cliente</h2>
          <p><span className="font-semibold">Nome:</span> {termo.clienteNome}</p>
          <p><span className="font-semibold">Telefone:</span> {termo.clienteTelefone ?? "Nao informado"}</p>
          <p><span className="font-semibold">Documento:</span> {termo.clienteDocumento ?? "Nao informado"}</p>
        </div>

        <div className="space-y-2">
          <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-kx-papel-legenda">Equipamento</h2>
          <p><span className="font-semibold">Equipamento:</span> {termo.equipamento}</p>
          <p><span className="font-semibold">Marca / Modelo:</span> {marcaModelo}</p>
          <p><span className="font-semibold">IMEI / Serie:</span> {imeiSerie}</p>
        </div>
      </section>

      <section className="space-y-2 break-inside-avoid">
        <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-kx-papel-legenda">Defeito e diagnostico</h2>
        <p><span className="font-semibold">Defeito relatado:</span> {termo.defeitoRelatado}</p>
        <p><span className="font-semibold">Diagnostico tecnico:</span> {diagnostico}</p>
      </section>

      <section className="break-inside-avoid border border-kx-papel-borda p-3">
        <h2 className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-kx-papel-legenda">Servicos executados</h2>
        <ul className="list-disc space-y-1 pl-5">
          {termo.servicosExecutados.map((servico) => (
            <li key={servico}>{servico}</li>
          ))}
        </ul>
      </section>

      <section className="space-y-2 break-inside-avoid rounded-sm border border-kx-papel-borda p-3">
        <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-kx-papel-legenda">Cobertura da garantia</h2>
        <p className="whitespace-pre-wrap">{termo.textoCoberturaGarantia}</p>
      </section>

      <section className="space-y-2 break-inside-avoid rounded-sm border border-kx-papel-borda p-3">
        <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-kx-papel-legenda">Nao coberto pela garantia</h2>
        <p className="whitespace-pre-wrap">{termo.textoExclusoesGarantia}</p>
      </section>

      <section className="space-y-2 break-inside-avoid rounded-sm border border-kx-papel-borda p-3">
        <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-kx-papel-legenda">Responsabilidade por dados</h2>
        <p className="whitespace-pre-wrap">{termo.textoResponsabilidadeDados}</p>
        <p>
          O aparelho foi testado no momento da entrega, juntamente com o cliente ou conforme os testes internos disponiveis. Ao retirar o equipamento, o cliente declara estar ciente dos servicos executados e das condicoes de garantia descritas neste termo.
        </p>
      </section>

      <section className="space-y-2 break-inside-avoid rounded-sm border border-kx-papel-borda p-3">
        <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-kx-papel-legenda">Validacao da garantia</h2>
        <p>
          Para utilizacao da garantia, o cliente devera apresentar este termo ou informar o numero da OS. O equipamento sera submetido a analise tecnica para confirmacao se o defeito esta relacionado ao servico executado.
        </p>
        <p>Este termo nao exclui os direitos previstos na legislacao aplicavel.</p>
      </section>

      <section className="grid grid-cols-2 gap-8 break-inside-avoid pt-2">
        <div>
          <p className="mb-8 border-b border-kx-papel-borda-forte pb-1 text-center font-medium">Assinatura do Cliente</p>
          <p className="text-center text-[10px] text-kx-papel-legenda">Nome legivel e documento</p>
        </div>
        <div>
          <p className="mb-8 border-b border-kx-papel-borda-forte pb-1 text-center font-medium">Assinatura da Loja / Tecnico</p>
          <p className="text-center text-[10px] text-kx-papel-legenda">Carimbo e responsavel tecnico</p>
        </div>
      </section>

      <footer className="pt-2 text-[10px] text-kx-papel-legenda">
        Data: {formatarData(termo.dataFinalizacao)}
      </footer>
    </div>
  );
}
