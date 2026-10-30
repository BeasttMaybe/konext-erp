import { notFound } from "next/navigation";
import { exigirContextoTenant } from "@/lib/tenant/exigir-contexto-tenant";
import { temPermissao } from "@/lib/auth/permissoes";
import { escopoOrdemServico } from "@/lib/auth/escopos";
import { obterConfiguracoes } from "@/app/actions/configuracoes";
import { obterHistoricoOS } from "@/app/actions/os";
import { SecaoItensOS } from "@/components/os/secao-itens-os";
import { listarMarcasPecaAtivas } from "@/app/actions/marcas-peca";
import { SecaoTecnicosOS } from "@/components/os/secao-tecnicos-os";
import { AcaoGarantiaOS } from "@/components/os/garantias/acao-garantia-os";
import { CabecalhoOS } from "@/components/os/detalhe/cabecalho-os";
import { CartoesResumoOS } from "@/components/os/detalhe/cartoes-resumo-os";
import { CartaoClienteOS } from "@/components/os/detalhe/cartao-cliente-os";
import { CartaoAparelhoOS } from "@/components/os/detalhe/cartao-aparelho-os";
import { CartaoEntradaOS } from "@/components/os/detalhe/cartao-entrada-os";
import { SecaoFotosOS } from "@/components/os/detalhe/secao-fotos-os";
import { HistoricoOS } from "@/components/os/detalhe/historico-os";
import type { EtapaOS, SituacaoOS, TecnicoDaOS } from "@/types/os";
import { deDecimal, type EntradaDecimal, paraMoeda, somar } from "@/lib/dinheiro";

type PropsPaginaDetalheOS = {
  params: Promise<{
    id: string;
  }>;
};

type ItemOSCarregado = {
  id: string;
  descricao: string;
  tipoPeca: "TELA" | "BATERIA" | "CONECTOR_CARGA" | "TAMPA_IPHONE" | "TAMPA_ANDROID" | "OUTROS";
  /** null quando o usuário logado não tem a permissão os.ver_custos (F-41). */
  custoPeca: number | null;
  valorCobrado: number;
  /** null em itens lançados antes do cadastro de marcas existir. */
  marcaPecaId: string | null;
  marcaPecaNome: string | null;
  criadoEm: string;
};

type OrdemServicoDetalheDelegate = {
  findUnique?: (args: unknown) => Promise<OrdemServicoDetalhe | null>;
  findFirst?: (args: unknown) => Promise<OrdemServicoDetalhe | null>;
};

type OrdemServicoDetalhe = {
  id: string;
  numeroOs: number;
  status: string;
  etapa: string;
  situacao?: string | null;
  equipamento?: string | null;
  marca?: string | null;
  modelo?: string | null;
  imei?: string | null;
  senha?: string | null;
  senhaDesenho?: string | null;
  relatoCliente?: string | null;
  condicaoFisica?: string | null;
  acessorios?: string | null;
  criadoEm?: Date | string | null;
  atualizadoEm?: Date | string | null;
  excluidaEm?: Date | string | null;
  ehRetornoGarantia?: boolean | null;
  entregueSemServico?: boolean | null;
  motivoSemServico?: string | null;
  cliente?: { id?: string | null; nomeRazaoSocial?: string | null; telefone?: string | null; isWhatsapp?: boolean | null } | null;
  itens?: Array<{
    id: string;
    descricao?: string | null;
    tipoPeca?: string | null;
    custoPeca?: EntradaDecimal | null;
    valorCobrado?: EntradaDecimal | null;
    marcaPeca?: { id?: string | null; nome?: string | null } | null;
    criadoEm?: Date | string | null;
  }>;
  transacoes?: Array<{
    vendaId?: string | null;
    origem?: string | null;
    valor?: EntradaDecimal | null;
    status?: string | null;
    venda?: { id?: string | null; valorTotal?: EntradaDecimal | null } | null;
  }>;
  termoGarantia?: { id?: string | null; prazoGarantiaDias?: number | null } | null;
  tecnicos?: Array<{
    usuarioId?: string | null;
    participacaoPercentual?: unknown;
    principal?: boolean | null;
    usuario?: { nome?: string | null } | null;
  }>;
};

function extrairNumeroOsDoSlug(entrada: string): number | null {
  const slug = entrada.trim().toLowerCase();
  const match = slug.match(/^os-(\d+)$|^os-\d{4}-(\d+)$/);
  const numeroTexto = match?.[1] ?? match?.[2];
  if (!numeroTexto) return null;
  const numero = Number(numeroTexto);
  return Number.isFinite(numero) ? numero : null;
}

/** Mesma aproximação do cartão do Kanban (components/os/cartao-os.tsx): sem carimbo de "entrou nesta etapa em" no schema ainda. */
function diasDesde(dataISO: string): number {
  const diffMs = Date.now() - new Date(dataISO).getTime();
  return Math.max(0, Math.floor(diffMs / 86_400_000));
}

const INCLUDE_DETALHE_OS = {
  cliente: {
    select: {
      id: true,
      nomeRazaoSocial: true,
      telefone: true,
      isWhatsapp: true,
    },
  },
  itens: {
    include: {
      marcaPeca: { select: { id: true, nome: true } },
    },
  },
  termoGarantia: {
    select: {
      id: true,
      prazoGarantiaDias: true,
    },
  },
  transacoes: {
    select: {
      vendaId: true,
      origem: true,
      valor: true,
      status: true,
      venda: {
        select: {
          id: true,
          valorTotal: true,
        },
      },
    },
  },
  tecnicos: {
    select: {
      usuarioId: true,
      participacaoPercentual: true,
      principal: true,
      usuario: { select: { nome: true } },
    },
  },
} as const;

export default async function PaginaDetalheOS({ params }: PropsPaginaDetalheOS) {
  const { id } = await params;
  const contexto = await exigirContextoTenant();
  const podeVerCustos = temPermissao(contexto, "os.ver_custos");
  const podeEditarOS = temPermissao(contexto, "os.editar");
  const podeExcluirOS = temPermissao(contexto, "os.excluir");
  const prisma = contexto.prisma;
  const prismaAny = prisma as typeof prisma & {
    ordemServico?: OrdemServicoDetalheDelegate;
    OrdemServico?: OrdemServicoDetalheDelegate;
  };
  const delegateOrdemServico = prismaAny.ordemServico ?? prismaAny.OrdemServico;

  if (!delegateOrdemServico?.findUnique) {
    throw new Error("Delegate Prisma de OrdemServico nao disponivel.");
  }

  // Escopo de visibilidade (Fase 1D-2): sem os.ver_todas, uma URL direta pra
  // OS de outro tecnico devolve null aqui — cai no `notFound()` abaixo,
  // exatamente como uma OS inexistente. Nunca "sem permissao", sempre "nao
  // encontrada" — ver lib/auth/escopos.ts.
  const escopoOS = escopoOrdemServico(contexto);

  let osBanco = await delegateOrdemServico.findUnique({
    where: { id, ...escopoOS },
    include: INCLUDE_DETALHE_OS,
  });

  if (!osBanco) {
    const numeroOsSlug = extrairNumeroOsDoSlug(id);

    if (numeroOsSlug !== null && delegateOrdemServico.findFirst) {
      osBanco = (await delegateOrdemServico.findFirst({
        where: { numeroOs: numeroOsSlug, ...escopoOS },
        include: INCLUDE_DETALHE_OS,
      })) as OrdemServicoDetalhe | null;
    }
  }

  if (!osBanco || osBanco.excluidaEm) {
    notFound();
  }

  const config = await obterConfiguracoes();
  // Só as ativas: marca desativada sai do seletor, mas continua aparecendo nos
  // itens antigos que já a usam (o nome vem do próprio item, acima).
  const marcasAtivas = await listarMarcasPecaAtivas();

  const itensNormalizados: ItemOSCarregado[] = (osBanco.itens ?? [])
    .map((item) => ({
      id: String(item.id),
      descricao: String(item.descricao ?? ""),
      tipoPeca: String(item.tipoPeca ?? "OUTROS") as ItemOSCarregado["tipoPeca"],
      // F-41: custo/margem só vai para o cliente com os.ver_custos.
      custoPeca: podeVerCustos ? paraMoeda(deDecimal(item.custoPeca ?? 0)) : null,
      valorCobrado: paraMoeda(deDecimal(item.valorCobrado ?? 0)),
      marcaPecaId: item.marcaPeca?.id ? String(item.marcaPeca.id) : null,
      marcaPecaNome: item.marcaPeca?.nome ? String(item.marcaPeca.nome) : null,
      criadoEm: new Date(item.criadoEm ?? osBanco?.criadoEm ?? new Date()).toISOString(),
    }))
    .sort((a, b) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime());

  const statusAtual = String(osBanco.status);
  const etapa = String(osBanco.etapa) as EtapaOS;
  const situacao = (osBanco.situacao ? String(osBanco.situacao) : null) as SituacaoOS | null;
  const imei = osBanco.imei ? String(osBanco.imei) : null;
  const senha = osBanco.senha ? String(osBanco.senha) : null;
  const senhaDesenho = osBanco.senhaDesenho ? String(osBanco.senhaDesenho) : null;
  const relatoCliente = String(osBanco.relatoCliente ?? "Não informado");
  const condicaoFisica = String(osBanco.condicaoFisica ?? "");
  const acessorios = String(osBanco.acessorios ?? "");
  const numeroOsExibicao = String(osBanco.numeroOs);
  const nomeCliente = String(osBanco.cliente?.nomeRazaoSocial ?? "Não informado");
  const clienteTelefone = osBanco.cliente?.telefone ? String(osBanco.cliente.telefone) : null;
  const clienteAceitaWhatsapp = osBanco.cliente?.isWhatsapp !== false;
  const marca = osBanco.marca ? String(osBanco.marca) : null;
  const modelo = osBanco.modelo ? String(osBanco.modelo) : null;
  const dataAtualizacao = new Date(osBanco.atualizadoEm ?? osBanco.criadoEm ?? new Date()).toISOString();
  const idOs = String(osBanco.id);
  const possuiItens = itensNormalizados.length > 0;
  const possuiTermoGarantia = Boolean(osBanco.termoGarantia?.id);
  const ehRetornoGarantia = Boolean(osBanco.ehRetornoGarantia);
  const entregueSemServico = Boolean(osBanco.entregueSemServico);
  const motivoSemServico = osBanco.motivoSemServico ? String(osBanco.motivoSemServico) : null;
  const tecnicosNormalizados: TecnicoDaOS[] = (osBanco.tecnicos ?? [])
    .filter((tecnico) => Boolean(tecnico?.usuarioId))
    .map((tecnico) => ({
      usuarioId: String(tecnico.usuarioId),
      nome: String(tecnico.usuario?.nome ?? "Técnico"),
      participacaoPercentual: Number(tecnico.participacaoPercentual ?? 0),
      principal: Boolean(tecnico.principal),
    }));
  const transacaoPdvVinculada = (osBanco.transacoes ?? []).find(
    (transacao) => transacao?.vendaId && String(transacao.origem) === "ORDEM_SERVICO"
  );
  const possuiPedidoVenda = Boolean(transacaoPdvVinculada);
  const podeEnviarAoPdv = statusAtual === "PRONTO" && !possuiPedidoVenda;
  const podeGerarPedidoVenda = podeEnviarAoPdv && possuiItens;
  const valorVendaVinculada = paraMoeda(
    deDecimal(transacaoPdvVinculada?.venda?.valorTotal ?? transacaoPdvVinculada?.valor ?? 0)
  );

  const totalOS = paraMoeda(somar(...itensNormalizados.map((item) => deDecimal(item.valorCobrado))));
  const custoTotalOS = podeVerCustos
    ? paraMoeda(somar(...itensNormalizados.map((item) => deDecimal(item.custoPeca ?? 0))))
    : null;
  const garantiaDias = osBanco.termoGarantia?.prazoGarantiaDias ?? config.prazoGarantiaPadraoDias;

  const historico = await obterHistoricoOS(idOs, 50);

  return (
    <div className="w-full min-h-full bg-kx-fundo">
      <div className="max-w-[1600px] mx-auto flex flex-col gap-kx-4 px-4 py-kx-5 sm:px-6 lg:px-8">
        <CabecalhoOS
          osId={idOs}
          numeroOs={numeroOsExibicao}
          etapa={etapa}
          situacao={situacao}
          entregueSemServico={entregueSemServico}
          motivoSemServico={motivoSemServico}
          modeloImpressaoPadrao={config.modeloImpressaoOSPadrao}
          clienteTelefone={clienteTelefone}
          clienteAceitaWhatsapp={clienteAceitaWhatsapp}
          statusEhEntregue={statusAtual === "ENTREGUE"}
          ehRetornoGarantia={ehRetornoGarantia}
          possuiItens={possuiItens}
          prazoGarantiaPadraoDias={config.prazoGarantiaPadraoDias}
          prazoMinimoGarantiaDias={config.prazoMinimoGarantiaDias}
          prazoMaximoGarantiaDias={config.prazoMaximoGarantiaDias}
          podeEnviarAoPdv={podeEnviarAoPdv}
          podeGerarPedidoVenda={podeGerarPedidoVenda}
          possuiPedidoVenda={possuiPedidoVenda}
          podeExcluir={podeExcluirOS}
        />

        <CartoesResumoOS
          etapa={etapa}
          situacao={situacao}
          diasNaEtapa={diasDesde(dataAtualizacao)}
          totalOS={totalOS}
          custoTotal={custoTotalOS}
          garantiaDias={garantiaDias}
          garantiaAtiva={possuiTermoGarantia}
          pagamentoConcluido={possuiPedidoVenda}
          valorPago={possuiPedidoVenda ? valorVendaVinculada : null}
        />

        {!possuiTermoGarantia && statusAtual !== "ENTREGUE" && (
          <AcaoGarantiaOS
            osId={idOs}
            statusOS={statusAtual}
            possuiTermoGarantia={possuiTermoGarantia}
            possuiItens={possuiItens}
          />
        )}

        <section className="grid grid-cols-1 lg:grid-cols-[340px_minmax(0,1fr)] gap-kx-4 items-start">
          <div className="flex flex-col gap-kx-4">
            <CartaoClienteOS
              osId={idOs}
              nome={nomeCliente}
              telefone={clienteTelefone}
              aceitaWhatsapp={clienteAceitaWhatsapp}
            />
            <CartaoAparelhoOS osId={idOs} marca={marca} modelo={modelo} imei={imei} senha={senha} senhaDesenho={senhaDesenho} />
            <CartaoEntradaOS relatoCliente={relatoCliente} condicaoFisica={condicaoFisica} acessorios={acessorios} />
          </div>

          <div className="flex flex-col gap-kx-4">
            <SecaoFotosOS />
            <SecaoTecnicosOS osId={idOs} numeroOs={numeroOsExibicao} tecnicos={tecnicosNormalizados} podeEditar={podeEditarOS} />
            <SecaoItensOS
              osId={idOs}
              numeroOs={Number(osBanco.numeroOs)}
              itens={itensNormalizados}
              marcasDisponiveis={marcasAtivas}
            />
            <HistoricoOS linhas={historico} />
          </div>
        </section>
      </div>
    </div>
  );
}
