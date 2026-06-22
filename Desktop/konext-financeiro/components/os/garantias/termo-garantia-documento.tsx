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

const coberturaGarantia = [
  "Defeito diretamente relacionado ao servico realizado.",
  "Falha da peca substituida pela assistencia tecnica, quando aplicavel.",
  "Retrabalho referente ao mesmo defeito descrito na OS.",
  "Falha tecnica decorrente do reparo, apos analise interna.",
];

const naoCobertoGarantia = [
  "Novos defeitos sem relacao com o reparo original.",
  "Quedas, impactos, amassados, trincas, quebra de tela, carcaca danificada ou pressao no aparelho apos a entrega.",
  "Danos por liquido, oxidacao, umidade, corrosao ou exposicao a agua apos a entrega.",
  "Equipamento aberto ou reparado por terceiros apos a entrega.",
  "Mau uso, carregamento inadequado, acessorios incompativeis ou cabos/carregadores de baixa qualidade.",
  "Problemas de software causados por atualizacoes, resets, apps de terceiros, malware, configuracoes do usuario, bloqueios de conta, senhas, bloqueios iCloud/Google ou perda de dados.",
  "Desgaste natural de bateria quando a OS nao incluiu troca de bateria.",
  "Defeitos intermitentes nao identificados em testes e sem relacao com o reparo realizado.",
  "Defeitos causados por danos preexistentes em placa, salvo quando a OS cobrir reparo de placa de forma especifica.",
  "Acessorios nao inclusos na OS.",
  "Desgaste estetico, riscos, marcas e detalhes visuais sem relacao com o reparo.",
];

export function TermoGarantiaDocumento({ termo }: TermoGarantiaDocumentoProps) {
  const marcaModelo = termo.marcaModelo?.trim() || "Nao informado";
  const imeiSerie = termo.imeiOuSerial?.trim() || "Nao informado";
  const diagnostico = termo.diagnosticoTecnico?.trim() || "Nao informado";

  return (
    <div className="space-y-5 text-[11px] leading-[1.45] text-zinc-800">
      <header className="border-b border-zinc-300 pb-4">
        <div className="flex items-start justify-between gap-6">
          <div className="max-w-[70%]">
            <p className="text-[28px] font-black leading-none tracking-tight text-zinc-900">{termo.empresa.nome}</p>
            {termo.empresa.documento && <p className="mt-1 text-[11px] text-zinc-600">Documento: {termo.empresa.documento}</p>}
            {termo.empresa.telefone && <p className="text-[11px] text-zinc-600">Telefone: {termo.empresa.telefone}</p>}
            {termo.empresa.endereco && <p className="text-[11px] text-zinc-600">Endereco: {termo.empresa.endereco}</p>}
          </div>

          <div className="text-right">
            <p className="text-[16px] font-bold uppercase tracking-[0.08em] text-zinc-900">{tituloDocumento}</p>
            <p className="mt-1 text-[11px] text-zinc-700">OS: {termo.numeroOS}</p>
          </div>
        </div>

        <div className="mt-3 h-[2px] bg-emerald-500" />
      </header>

      <section className="grid grid-cols-2 gap-4 break-inside-avoid border border-zinc-200 p-3">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-zinc-500">Data de finalizacao</p>
          <p className="mt-1 text-[12px] font-semibold text-zinc-900">{formatarData(termo.dataFinalizacao)}</p>
        </div>
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-zinc-500">Prazo da garantia</p>
          <p className="mt-1 text-[12px] font-semibold text-zinc-900">{termo.prazoGarantiaDias} dias</p>
        </div>
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-zinc-500">Data final da garantia</p>
          <p className="mt-1 text-[12px] font-semibold text-zinc-900">{formatarData(termo.dataFimGarantia)}</p>
        </div>
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-zinc-500">Valor cobrado</p>
          <p className="mt-1 text-[12px] font-semibold text-zinc-900">{formatarMoeda(termo.valorCobrado)}</p>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-5 break-inside-avoid border-b border-zinc-200 pb-4">
        <div className="space-y-2">
          <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Cliente</h2>
          <p><span className="font-semibold">Nome:</span> {termo.clienteNome}</p>
          <p><span className="font-semibold">Telefone:</span> {termo.clienteTelefone ?? "Nao informado"}</p>
          <p><span className="font-semibold">Documento:</span> {termo.clienteDocumento ?? "Nao informado"}</p>
        </div>

        <div className="space-y-2">
          <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Equipamento</h2>
          <p><span className="font-semibold">Equipamento:</span> {termo.equipamento}</p>
          <p><span className="font-semibold">Marca / Modelo:</span> {marcaModelo}</p>
          <p><span className="font-semibold">IMEI / Serie:</span> {imeiSerie}</p>
        </div>
      </section>

      <section className="space-y-2 break-inside-avoid">
        <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Defeito e diagnostico</h2>
        <p><span className="font-semibold">Defeito relatado:</span> {termo.defeitoRelatado}</p>
        <p><span className="font-semibold">Diagnostico tecnico:</span> {diagnostico}</p>
      </section>

      <section className="break-inside-avoid border border-zinc-200 p-3">
        <h2 className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Servicos executados</h2>
        <ul className="list-disc space-y-1 pl-5">
          {termo.servicosExecutados.map((servico) => (
            <li key={servico}>{servico}</li>
          ))}
        </ul>
      </section>

      <section className="space-y-2 break-inside-avoid rounded-sm border border-zinc-200 p-3">
        <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Cobertura da garantia</h2>
        <p>
          A garantia cobre exclusivamente o servico executado e as pecas substituidas nesta Ordem de Servico, desde que o defeito apresentado esteja diretamente relacionado ao reparo realizado.
        </p>
        <ul className="list-disc space-y-1 pl-5">
          {coberturaGarantia.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="space-y-2 break-inside-avoid rounded-sm border border-zinc-200 p-3">
        <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Nao coberto pela garantia</h2>
        <ul className="list-disc space-y-1 pl-5">
          {naoCobertoGarantia.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="space-y-2 break-inside-avoid rounded-sm border border-zinc-200 p-3">
        <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Responsabilidade por dados</h2>
        <p>
          A assistencia tecnica nao se responsabiliza pela perda de dados, arquivos, fotos, videos, aplicativos, senhas, contas, backups ou informacoes pessoais armazenadas no aparelho. Recomenda-se que o cliente realize backup antes de qualquer procedimento tecnico.
        </p>
        <p>
          O aparelho foi testado no momento da entrega, juntamente com o cliente ou conforme os testes internos disponiveis. Ao retirar o equipamento, o cliente declara estar ciente dos servicos executados e das condicoes de garantia descritas neste termo.
        </p>
      </section>

      <section className="space-y-2 break-inside-avoid rounded-sm border border-zinc-200 p-3">
        <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Validacao da garantia</h2>
        <p>
          Para utilizacao da garantia, o cliente devera apresentar este termo ou informar o numero da OS. O equipamento sera submetido a analise tecnica para confirmacao se o defeito esta relacionado ao servico executado.
        </p>
        <p>Este termo nao exclui os direitos previstos na legislacao aplicavel.</p>
      </section>

      <section className="grid grid-cols-2 gap-8 break-inside-avoid pt-2">
        <div>
          <p className="mb-8 border-b border-zinc-400 pb-1 text-center font-medium">Assinatura do Cliente</p>
          <p className="text-center text-[10px] text-zinc-500">Nome legivel e documento</p>
        </div>
        <div>
          <p className="mb-8 border-b border-zinc-400 pb-1 text-center font-medium">Assinatura da Loja / Tecnico</p>
          <p className="text-center text-[10px] text-zinc-500">Carimbo e responsavel tecnico</p>
        </div>
      </section>

      <footer className="pt-2 text-[10px] text-zinc-500">
        Data: {formatarData(termo.dataFinalizacao)}
      </footer>
    </div>
  );
}
