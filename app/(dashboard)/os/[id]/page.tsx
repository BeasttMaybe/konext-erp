import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { exigirContextoTenant } from "@/lib/tenant/exigir-contexto-tenant";
import { obterConfiguracoes } from "@/app/actions/configuracoes";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { SecaoItensOS } from "@/components/os/secao-itens-os";
import { BotaoGerarPedidoVenda } from "@/components/os/botao-gerar-pedido-venda";
import { BotaoCopiarLinkRastreio } from "@/components/os/botao-copiar-link-rastreio";
import { AcaoGarantiaOS } from "@/components/os/garantias/acao-garantia-os";
import { MenuImprimirOS } from "@/components/os/menu-imprimir-os";

type PropsPaginaDetalheOS = {
  params: Promise<{
    id: string;
  }>;
};

type ItemOSCarregado = {
  id: string;
  descricao: string;
  tipoPeca: "TELA" | "BATERIA" | "CONECTOR_CARGA" | "TAMPA_IPHONE" | "TAMPA_ANDROID" | "OUTROS";
  custoPeca: number;
  valorCobrado: number;
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
  equipamento?: string | null;
  marca?: string | null;
  modelo?: string | null;
  imei?: string | null;
  numeroSerieImei?: string | null;
  senha?: string | null;
  senhaAcesso?: string | null;
  senhaDesenho?: string | null;
  padraoDesenho?: string | null;
  relatoCliente?: string | null;
  condicaoFisica?: string | null;
  acessorios?: string | null;
  acessoriosDeixados?: string | null;
  criadoEm?: Date | string | null;
  excluidaEm?: Date | string | null;
  cliente?: { nomeRazaoSocial?: string | null } | null;
  itens?: Array<{
    id: string;
    descricao?: string | null;
    tipoPeca?: string | null;
    tipo?: string | null;
    custoPeca?: number | null;
    valorCobrado?: number | null;
    criadoEm?: Date | string | null;
  }>;
  transacoes?: Array<{
    vendaId?: string | null;
    origem?: string | null;
    valor?: number | null;
    status?: string | null;
    formaRecebimento?: string | null;
    dataRecebimento?: Date | string | null;
    venda?: {
      id?: string | null;
      valorTotal?: number | null;
      formaPagamento?: string | null;
      criadoEm?: Date | string | null;
    } | null;
  }>;
  termoGarantia?: { id?: string | null } | null;
};

const mapaStatusLabel: Record<string, string> = {
  AGUARDANDO_ORCAMENTO: "Aguardando Orcamento",
  AGUARDANDO_APROVACAO: "Aguardando Aprovacao",
  APROVADO: "Aprovado",
  AGUARDANDO_PECA: "Aguardando Peca",
  EM_MANUTENCAO: "Em Manutencao",
  GARANTIA_RETORNO: "Garantia / Retorno",
  PRONTO: "Pronto",
  ENTREGUE: "Entregue",
};

const mapaStatusClasse: Record<string, string> = {
  AGUARDANDO_ORCAMENTO: "bg-slate-700 text-slate-100 border-slate-600",
  AGUARDANDO_APROVACAO: "bg-amber-500/20 text-amber-300 border-amber-400/40",
  APROVADO: "bg-blue-500/20 text-blue-300 border-blue-400/40",
  AGUARDANDO_PECA: "bg-orange-500/20 text-orange-300 border-orange-400/40",
  EM_MANUTENCAO: "bg-violet-500/20 text-violet-300 border-violet-400/40",
  GARANTIA_RETORNO: "bg-indigo-500/20 text-indigo-300 border-indigo-400/40",
  PRONTO: "bg-emerald-500/20 text-emerald-300 border-emerald-400/40",
  ENTREGUE: "bg-green-500/20 text-green-300 border-green-400/40",
};

function extrairPontosDesenho(valor: string | null | undefined): number[] {
  if (!valor) return [];
  return valor
    .split(/[^0-9]+/)
    .map((item) => Number(item))
    .filter((item) => Number.isInteger(item) && item >= 1 && item <= 9);
}

function extrairNumeroOsDoSlug(entrada: string): number | null {
  const slug = entrada.trim().toLowerCase();
  const match = slug.match(/^os-(\d+)$|^os-\d{4}-(\d+)$/);
  const numeroTexto = match?.[1] ?? match?.[2];
  if (!numeroTexto) return null;
  const numero = Number(numeroTexto);
  return Number.isFinite(numero) ? numero : null;
}

export default async function PaginaDetalheOS({ params }: PropsPaginaDetalheOS) {
  const { id } = await params;
  const contexto = await exigirContextoTenant();
  const prisma = contexto.prisma;
  const prismaAny = prisma as typeof prisma & {
    ordemServico?: OrdemServicoDetalheDelegate;
    OrdemServico?: OrdemServicoDetalheDelegate;
  };
  const delegateOrdemServico = prismaAny.ordemServico ?? prismaAny.OrdemServico;

  if (!delegateOrdemServico?.findUnique) {
    throw new Error("Delegate Prisma de OrdemServico nao disponivel.");
  }

  let osBanco = await delegateOrdemServico.findUnique({
    where: {
      id,
    },
    include: {
      cliente: {
        select: {
          nomeRazaoSocial: true,
        },
      },
      itens: true,
      termoGarantia: {
        select: {
          id: true,
        },
      },
      transacoes: {
        select: {
          vendaId: true,
          origem: true,
          valor: true,
          status: true,
          formaRecebimento: true,
          dataRecebimento: true,
          venda: {
            select: {
              id: true,
              valorTotal: true,
              formaPagamento: true,
              criadoEm: true,
            },
          },
        },
      },
    },
  });

  if (!osBanco) {
    const numeroOsSlug = extrairNumeroOsDoSlug(id);

    if (numeroOsSlug !== null && delegateOrdemServico.findFirst) {
      osBanco = await delegateOrdemServico.findFirst({
        where: {
          numeroOs: numeroOsSlug,
        },
        include: {
          cliente: {
            select: {
              nomeRazaoSocial: true,
            },
          },
          itens: true,
          termoGarantia: {
            select: {
              id: true,
            },
          },
          transacoes: {
            select: {
              vendaId: true,
              origem: true,
              valor: true,
              status: true,
              formaRecebimento: true,
              dataRecebimento: true,
              venda: {
                select: {
                  id: true,
                  valorTotal: true,
                  formaPagamento: true,
                  criadoEm: true,
                },
              },
            },
          },
        },
      });
    }
  }

  if (!osBanco) {
    notFound();
  }

  if (osBanco.excluidaEm) {
    notFound();
  }

  const config = await obterConfiguracoes();

  const itensDoBanco = (osBanco?.itens ?? []).map((item) => ({
    id: String(item.id),
    descricao: String(item.descricao ?? ""),
    tipoPeca: String(item.tipoPeca ?? "OUTROS") as ItemOSCarregado["tipoPeca"],
    custoPeca: Number(item.custoPeca ?? 0),
    valorCobrado: Number(item.valorCobrado ?? 0),
    criadoEm: new Date(item.criadoEm ?? osBanco?.criadoEm ?? new Date()).toISOString(),
  }));

  const itensNormalizados: ItemOSCarregado[] = itensDoBanco
    .sort((a: ItemOSCarregado, b: ItemOSCarregado) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime());

  const statusAtual = String(osBanco.status);
  const labelStatus = mapaStatusLabel[statusAtual] ?? statusAtual.replaceAll("_", " ");
  const classeStatus = mapaStatusClasse[statusAtual] ?? "bg-slate-700 text-slate-100 border-slate-600";
  const imei = String(osBanco.imei ?? "Nao informado");
  const senha = String(osBanco.senha ?? "Nao informada");
  const senhaDesenho = String(osBanco.senhaDesenho ?? "");
  const pontosDesenho = extrairPontosDesenho(senhaDesenho);
  const relatoCliente = String(osBanco.relatoCliente ?? "Nao informado");
  const condicaoFisica = String(osBanco.condicaoFisica ?? "Nao informada");
  const acessorios = String(osBanco.acessorios ?? "Nao informado");
  const numeroOs = Number(osBanco.numeroOs);
  const numeroOsExibicao = String(osBanco.numeroOs);
  const nomeCliente = String(osBanco.cliente?.nomeRazaoSocial ?? "Nao informado");
  const equipamento = String(osBanco.equipamento ?? "Nao informado");
  const marca = String(osBanco.marca ?? "Nao informada");
  const modelo = String(osBanco.modelo ?? "Nao informado");
  const criadoEm = new Date(osBanco.criadoEm ?? new Date()).toISOString();
  const idOs = String(osBanco.id);
  const possuiItens = itensNormalizados.length > 0;
  const possuiTermoGarantia = Boolean(osBanco.termoGarantia?.id);
  const transacaoPdvVinculada = (osBanco.transacoes ?? []).find((transacao) => {
    return transacao?.vendaId && String(transacao.origem) === "ORDEM_SERVICO";
  });
  const possuiPedidoVenda = Boolean(transacaoPdvVinculada);
  const podeEnviarAoPdv = statusAtual === "PRONTO" && !possuiPedidoVenda;
  const podeGerarPedidoVenda = podeEnviarAoPdv && possuiItens;
  const vendaVinculadaId = String(transacaoPdvVinculada?.venda?.id ?? transacaoPdvVinculada?.vendaId ?? "");
  const valorVendaVinculada =
    typeof transacaoPdvVinculada?.venda?.valorTotal === "number"
      ? transacaoPdvVinculada.venda.valorTotal
      : Number(transacaoPdvVinculada?.valor ?? 0);
  const statusVendaVinculada = String(transacaoPdvVinculada?.status ?? "PENDENTE");

  return (
    <div className="w-full min-h-full flex flex-col bg-slate-100 dark:bg-slate-950">
      <div className="px-6 lg:px-8 py-6 border-b border-border bg-white dark:bg-slate-900">
        <div className="max-w-7xl mx-auto w-full space-y-2">
          <Link
            href="/os"
            className="inline-flex items-center text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 transition-colors"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Voltar
          </Link>

          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-50">
              Ordem de Servico #{numeroOsExibicao}
            </h1>
            <Badge className={`border ${classeStatus}`}>{labelStatus}</Badge>
            <MenuImprimirOS osId={idOs} modeloPadrao={config.modeloImpressaoOSPadrao} />
            <AcaoGarantiaOS
              osId={idOs}
              statusOS={statusAtual}
              possuiTermoGarantia={possuiTermoGarantia}
              possuiItens={possuiItens}
              mostrarTextoBloqueio
            />
            <BotaoCopiarLinkRastreio osId={idOs} />
            {podeGerarPedidoVenda && <BotaoGerarPedidoVenda osId={idOs} />}
            {podeEnviarAoPdv && !possuiItens && (
              <div className="relative flex items-center">
                <BotaoGerarPedidoVenda
                  osId={idOs}
                  desabilitado
                  mensagemBloqueio="Cadastre uma peca ou servico antes de enviar a OS ao PDV."
                />
                <p className="absolute left-0 top-full mt-1 whitespace-nowrap text-xs text-slate-500">
                  Cadastre uma peca ou servico antes de enviar a OS ao PDV.
                </p>
              </div>
            )}
            {!podeGerarPedidoVenda && possuiPedidoVenda && (
              <Badge variant="outline" className="border-emerald-500 text-emerald-600">
                Pedido de venda ja gerado
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 lg:px-8 py-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-6">
            <Card className="border-border bg-white dark:bg-slate-900 p-5">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Cliente</h2>
              <div className="space-y-2 text-sm">
                <p className="text-slate-500 dark:text-slate-400">Nome</p>
                <p className="font-semibold text-slate-900 dark:text-slate-100">
                  {nomeCliente}
                </p>
              </div>
            </Card>

            <Card className="border-border bg-white dark:bg-slate-900 p-5">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Aparelho</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-500 dark:text-slate-400">Equipamento</p>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">{equipamento}</p>
                </div>
                <div>
                  <p className="text-slate-500 dark:text-slate-400">Marca</p>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">{marca}</p>
                </div>
                <div>
                  <p className="text-slate-500 dark:text-slate-400">Modelo</p>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">{modelo}</p>
                </div>
                <div>
                  <p className="text-slate-500 dark:text-slate-400">IMEI</p>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">{imei}</p>
                </div>
              </div>
            </Card>

            <Card className="border-border bg-white dark:bg-slate-900 p-5">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Seguranca</h2>
              <div className="space-y-4 text-sm">
                <div>
                  <p className="text-slate-500 dark:text-slate-400">Senha</p>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">{senha}</p>
                </div>

                <div>
                  <p className="text-slate-500 dark:text-slate-400 mb-3">Senha de desenho</p>
                  <div className="grid grid-cols-3 gap-3 w-[180px]">
                    {Array.from({ length: 9 }, (_, indice) => {
                      const ponto = indice + 1;
                      const ordem = pontosDesenho.indexOf(ponto) + 1;
                      const ativo = ordem > 0;

                      return (
                        <div
                          key={ponto}
                          className={`relative h-12 w-12 rounded-full border ${
                            ativo
                              ? "bg-emerald-500/30 border-emerald-400/70"
                              : "bg-slate-200 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                          }`}
                        >
                          {ativo && (
                            <span className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-emerald-600 text-[10px] leading-5 text-white text-center font-bold">
                              {ordem}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-3">
                    Sequencia registrada: {pontosDesenho.length > 0 ? pontosDesenho.join("-") : "Nao definida"}
                  </p>
                </div>
              </div>
            </Card>

            <Card className="border-border bg-white dark:bg-slate-900 p-5">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Checklist de entrada</h2>
              <div className="space-y-4 text-sm">
                <div>
                  <p className="text-slate-500 dark:text-slate-400">Relato do cliente</p>
                  <p className="font-medium text-slate-900 dark:text-slate-100 whitespace-pre-wrap">{relatoCliente}</p>
                </div>
                <div>
                  <p className="text-slate-500 dark:text-slate-400">Condicao fisica</p>
                  <p className="font-medium text-slate-900 dark:text-slate-100 whitespace-pre-wrap">{condicaoFisica}</p>
                </div>
                <div>
                  <p className="text-slate-500 dark:text-slate-400">Acessorios</p>
                  <p className="font-medium text-slate-900 dark:text-slate-100 whitespace-pre-wrap">{acessorios}</p>
                </div>
              </div>
            </Card>
          </div>

          <div className="space-y-6">
            {possuiPedidoVenda && (
              <Card className="border-emerald-300 bg-emerald-50/70 dark:border-emerald-800 dark:bg-emerald-950/20 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                      Pedido no PDV gerado
                    </p>
                    <p className="text-xs text-emerald-700/80 dark:text-emerald-400/80 mt-1">
                      Venda vinculada e persistida para esta OS.
                    </p>
                  </div>
                  <Badge variant="outline" className="border-emerald-500 text-emerald-700 dark:text-emerald-300">
                    {statusVendaVinculada}
                  </Badge>
                </div>
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                  <div>
                    <p className="text-emerald-700/80 dark:text-emerald-400/80">Venda vinculada</p>
                    <p className="font-semibold text-emerald-900 dark:text-emerald-200">
                      {vendaVinculadaId ? `#${vendaVinculadaId.slice(0, 8)}` : "Nao informada"}
                    </p>
                  </div>
                  <div>
                    <p className="text-emerald-700/80 dark:text-emerald-400/80">Valor</p>
                    <p className="font-semibold text-emerald-900 dark:text-emerald-200">
                      {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
                        Number.isFinite(valorVendaVinculada) ? valorVendaVinculada : 0
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-emerald-700/80 dark:text-emerald-400/80">Origem</p>
                    <p className="font-semibold text-emerald-900 dark:text-emerald-200">PDV</p>
                  </div>
                </div>
              </Card>
            )}

            <SecaoItensOS osId={idOs} numeroOs={numeroOs} itens={itensNormalizados} />
            <Card className="border-border bg-white dark:bg-slate-900 p-5">
              <p className="text-xs text-slate-500 dark:text-slate-400">Criada em</p>
              <p className="font-semibold text-slate-900 dark:text-slate-100 mt-1">
                {new Date(criadoEm).toLocaleDateString("pt-BR")}
              </p>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
