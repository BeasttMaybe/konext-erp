"use server";

import { revalidatePath } from "next/cache";
import { Prisma, type ResultadoRetornoGarantia } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { exigirSessao } from "@/lib/auth/sessao";
import { ACOES_AUDITORIA, ENTIDADES_AUDITORIA } from "@/lib/auditoria-constantes";
import { contextoAuditoriaDoUsuario, registrarLogAuditoria } from "@/lib/auditoria";
import {
  mensagemIndicaRuntimeLegadoConfiguracao,
  obterDefaultsConfiguracaoOsGarantias,
  normalizarTextoGarantia,
  TEXTO_COBERTURA_GARANTIA_PADRAO,
  TEXTO_EXCLUSOES_GARANTIA_PADRAO,
  TEXTO_RESPONSABILIDADE_DADOS_PADRAO,
} from "@/lib/configuracoes-os-garantias";

export type StatusGarantia =
  | "ATIVA"
  | "PERTO_DO_VENCIMENTO"
  | "VENCIDA"
  | "RETORNO_EM_ANDAMENTO"
  | "RETORNO_FINALIZADO"
  | "SEM_COBERTURA"
  | "CANCELADA";

export type ResultadoAcao =
  | { sucesso: true; mensagem: string }
  | { sucesso: false; erro: string };

export type RegistrarRetornoGarantiaInput = {
  termoGarantiaId: string;
  motivo: string;
  descricao: string;
  analiseTecnica?: string;
  resultado: ResultadoRetornoGarantia;
};

export type GerarTermoGarantiaOSInput = {
  osId: string;
  prazoGarantiaDias: number;
};

export type ResultadoGerarGarantia =
  | { sucesso: true; mensagem: string; osId: string; termoGarantiaId: string }
  | { sucesso: false; erro: string };

export type FinalizarRetornoGarantiaInput = {
  retornoGarantiaId: string;
  resultado: Exclude<ResultadoRetornoGarantia, "EM_ANALISE">;
  analiseTecnica?: string;
  descricaoServico?: string;
  pecasAdicionais?: string;
  houveTroca?: boolean;
  houveCobranca?: boolean;
  valorAdicional?: number;
  observacoesTecnicas?: string;
};

export type FiltrosGarantiaInput = {
  busca?: string;
  status?: "TODAS" | StatusGarantia;
  retorno?: "TODAS" | "COM_RETORNO" | "SEM_RETORNO";
  vencimentoProximo?: boolean;
  dataInicio?: string;
  dataFim?: string;
  pagina?: number;
  tamanhoPagina?: number;
};

export type LinhaGarantiaOS = {
  termoGarantiaId: string;
  osId: string;
  numeroOS: string;
  clienteNome: string;
  clienteTelefone: string | null;
  clienteDocumento: string | null;
  equipamento: string;
  marcaModelo: string | null;
  imeiOuSerial: string | null;
  servicosExecutados: string[];
  pecasOuServicos: string[];
  valorCobrado: number;
  dataFinalizacao: string;
  prazoGarantiaDias: number;
  dataFimGarantia: string;
  diasRestantes: number;
  statusGarantia: StatusGarantia;
  teveRetorno: boolean;
  retornoEmAndamento: boolean;
  quantidadeRetornos: number;
  ultimoRetornoEm: string | null;
  ultimoMotivoRetorno: string | null;
  ultimoResultadoRetorno: ResultadoRetornoGarantia | null;
  osRetornoId: string | null;
  numeroOSRetorno: string | null;
};

export type DashboardGarantiasOS = {
  garantiasAtivas: number;
  vencemEm7Dias: number;
  garantiasVencidas: number;
  comRetorno: number;
  taxaRetorno: number;
  valorEmGarantia: number;
  principaisServicosEmRetorno: Array<{ nome: string; quantidade: number }>;
  pecasComMaisRetorno: Array<{ nome: string; quantidade: number }>;
};

export type HistoricoConsertoCliente = {
  osId: string;
  numeroOS: string;
  data: string;
  equipamento: string;
  defeitoRelatado: string;
  diagnosticoTecnico: string | null;
  servicosExecutados: string[];
  pecasSubstituidas: string[];
  valorCobrado: number;
  statusFinal: string;
  gerouGarantia: boolean;
  teveRetorno: boolean;
};

export type DadosTermoGarantia = {
  termoGarantiaId: string;
  osId: string;
  numeroOS: string;
  dataFinalizacao: string;
  clienteNome: string;
  clienteTelefone: string | null;
  clienteDocumento: string | null;
  equipamento: string;
  marcaModelo: string | null;
  imeiOuSerial: string | null;
  defeitoRelatado: string;
  diagnosticoTecnico: string | null;
  servicosExecutados: string[];
  valorCobrado: number;
  prazoGarantiaDias: number;
  dataFimGarantia: string;
  textoGarantia: string;
  textoCoberturaGarantia: string;
  textoExclusoesGarantia: string;
  textoResponsabilidadeDados: string;
  empresa: {
    nome: string;
    documento: string | null;
    telefone: string | null;
    endereco: string | null;
    logoUrl: string | null;
  };
};

export type ListagemGarantiasOS =
  | {
      sucesso: true;
      dados: LinhaGarantiaOS[];
      total: number;
      pagina: number;
      totalPaginas: number;
    }
  | {
      sucesso: false;
      erro: string;
    };

export type ContextoGarantiaOS = {
  osId: string;
  numeroOS: string;
  statusOS: string;
  possuiTermoGarantia: boolean;
  possuiItens: boolean;
};

const STATUS_PERMITE_GARANTIA = "PRONTO";
const MENSAGEM_ERRO_STATUS_GARANTIA = "A garantia so pode ser gerada quando a OS estiver como Pronto.";
const MENSAGEM_ERRO_GARANTIA_SEM_ITENS = "Para gerar a garantia, cadastre pelo menos uma peca ou servico na OS.";
const MENSAGEM_PRAZO_OBRIGATORIO = "Informe o prazo de garantia.";
const MENSAGEM_PRAZO_INVALIDO = "Informe um prazo de garantia valido.";
const MENSAGEM_ERRO_GERAR_GARANTIA = "Nao foi possivel gerar o termo de garantia. Tente novamente.";

function normalizarTexto(valor: string | null | undefined): string {
  return String(valor ?? "").trim();
}

function inicioDoDia(data = new Date()): Date {
  return new Date(data.getFullYear(), data.getMonth(), data.getDate(), 0, 0, 0, 0);
}

function fimDoDia(data = new Date()): Date {
  return new Date(data.getFullYear(), data.getMonth(), data.getDate(), 23, 59, 59, 999);
}

function adicionarDias(data: Date, dias: number): Date {
  const copia = new Date(data);
  copia.setDate(copia.getDate() + dias);
  return copia;
}

function validarPrazoGarantiaDias(valor: unknown): number {
  const textoValor = String(valor ?? "").trim();
  if (!textoValor) {
    throw new Error(MENSAGEM_PRAZO_OBRIGATORIO);
  }

  const numero = Number(textoValor);
  if (!Number.isInteger(numero) || numero < 1 || numero > 365) {
    throw new Error(MENSAGEM_PRAZO_INVALIDO);
  }

  return numero;
}

function diferencaDias(base: Date, alvo: Date): number {
  const umDiaMs = 1000 * 60 * 60 * 24;
  const inicioBase = inicioDoDia(base).getTime();
  const inicioAlvo = inicioDoDia(alvo).getTime();
  return Math.ceil((inicioAlvo - inicioBase) / umDiaMs);
}

function formatarNumeroOS(numero: number): string {
  const ano = new Date().getFullYear();
  return `OS-${ano}-${String(numero).padStart(3, "0")}`;
}

function calcularStatusGarantia(parametros: {
  cancelada: boolean;
  dataFimGarantia: Date;
  retornoEmAndamento: boolean;
  quantidadeRetornos: number;
  ultimoResultadoRetorno: ResultadoRetornoGarantia | null;
}): StatusGarantia {
  const hoje = inicioDoDia();
  const limiteProximo = adicionarDias(hoje, 7);

  if (parametros.cancelada) return "CANCELADA";
  if (parametros.retornoEmAndamento) return "RETORNO_EM_ANDAMENTO";
  if (parametros.quantidadeRetornos > 0) {
    if (parametros.ultimoResultadoRetorno === "IMPROCEDENTE" || parametros.ultimoResultadoRetorno === "SEM_GARANTIA") {
      return "SEM_COBERTURA";
    }

    return "RETORNO_FINALIZADO";
  }
  if (parametros.dataFimGarantia < hoje) return "VENCIDA";
  if (parametros.dataFimGarantia <= limiteProximo) return "PERTO_DO_VENCIMENTO";
  return "ATIVA";
}

function montarServicosExecutados(itens: Array<{ descricao: string; tipoPeca: string }>): string[] {
  const descricoes = itens
    .map((item) => normalizarTexto(item.descricao))
    .filter((descricao) => descricao.length > 0);

  if (descricoes.length > 0) return Array.from(new Set(descricoes));

  return itens.map((item) => `Servico em ${String(item.tipoPeca).replaceAll("_", " ")}`);
}

function montarTextoGarantia(dados: {
  numeroOS: string;
  dataFinalizacao: string;
  clienteNome: string;
  equipamento: string;
  servicosExecutados: string[];
  prazoGarantiaDias: number;
  textoCoberturaGarantia: string;
  textoExclusoesGarantia: string;
  textoResponsabilidadeDados: string;
}): string {
  const servicos = dados.servicosExecutados.length > 0
    ? dados.servicosExecutados.map((servico) => `- ${servico}`).join("\n")
    : "- Servicos conforme Ordem de Servico";

  return [
    "TERMO DE GARANTIA",
    "",
    `OS: ${dados.numeroOS}`,
    `Data de finalizacao: ${dados.dataFinalizacao}`,
    `Cliente: ${dados.clienteNome}`,
    `Equipamento: ${dados.equipamento}`,
    "",
    "Servicos executados e pecas substituidas:",
    servicos,
    "",
    `Prazo de garantia: ${dados.prazoGarantiaDias} dias corridos a partir da data de finalizacao da OS.`,
    "",
    dados.textoCoberturaGarantia,
    "",
    "Cobertura da garantia:",
    "- Defeito diretamente relacionado ao servico realizado.",
    "- Falha da peca substituida pela assistencia tecnica, quando aplicavel.",
    "- Retrabalho referente ao mesmo defeito descrito na OS.",
    "- Falha tecnica decorrente do reparo, apos analise interna.",
    "",
    "Nao coberto pela garantia:",
    dados.textoExclusoesGarantia,
    "",
    "Responsabilidade por dados:",
    dados.textoResponsabilidadeDados,
    "",
    "Testes e retirada:",
    "O aparelho foi testado no momento da entrega, juntamente com o cliente ou conforme os testes internos disponiveis. Ao retirar o equipamento, o cliente declara estar ciente dos servicos executados e das condicoes de garantia descritas neste termo.",
    "",
    "Validacao da garantia:",
    "Para utilizacao da garantia, o cliente devera apresentar este termo ou informar o numero da OS. O equipamento sera submetido a analise tecnica para confirmacao se o defeito esta relacionado ao servico executado.",
    "",
    "Este termo nao exclui os direitos previstos na legislacao aplicavel.",
  ].join("\n");
}

type ClienteTransacional = {
  nomeRazaoSocial: string;
  telefone: string | null;
  documento: string | null;
};

type OsTransacional = {
  id: string;
  numeroOs: number;
  status: string;
  equipamento: string;
  marca: string | null;
  modelo: string | null;
  imei: string | null;
  relatoCliente: string;
  observacoes: string | null;
  atualizadoEm: Date;
  excluidaEm: Date | null;
  prazoGarantiaDias: number | null;
  cliente: ClienteTransacional;
  itens: Array<{ descricao: string; tipoPeca: string; valorCobrado: number }>;
  termoGarantia: {
    id: string;
    prazoGarantiaDias: number;
    dataInicioGarantia: Date;
    dataFimGarantia: Date;
  } | null;
};

type ConfiguracaoTermo = {
  nomeFantasia: string;
  razaoSocial: string;
  cnpj: string;
  telefone: string;
  logradouro: string;
  numero: string;
  bairro: string;
  cidade: string;
  estado: string;
  logoUrl?: string | null;
  prazoGarantiaPadraoDias?: number | null;
  prazoMinimoGarantiaDias?: number | null;
  prazoMaximoGarantiaDias?: number | null;
  exigirItemParaGarantia?: boolean | null;
  permitirGarantiaPersonalizada?: boolean | null;
  textoCoberturaGarantia?: string | null;
  textoExclusoesGarantia?: string | null;
  textoResponsabilidadeDados?: string | null;
};

type RegrasGarantiaAplicadas = {
  prazoPadrao: number;
  prazoMinimo: number;
  prazoMaximo: number;
  exigirItemParaGarantia: boolean;
  permitirGarantiaPersonalizada: boolean;
  textoCoberturaGarantia: string;
  textoExclusoesGarantia: string;
  textoResponsabilidadeDados: string;
};

type ClientTx = Prisma.TransactionClient | typeof prisma;

function obterRegrasGarantia(configuracao: ConfiguracaoTermo | null | undefined): RegrasGarantiaAplicadas {
  const defaults = obterDefaultsConfiguracaoOsGarantias();

  return {
    prazoPadrao:
      typeof configuracao?.prazoGarantiaPadraoDias === "number"
        ? Number(configuracao.prazoGarantiaPadraoDias)
        : defaults.prazoGarantiaPadraoDias,
    prazoMinimo:
      typeof configuracao?.prazoMinimoGarantiaDias === "number"
        ? Number(configuracao.prazoMinimoGarantiaDias)
        : defaults.prazoMinimoGarantiaDias,
    prazoMaximo:
      typeof configuracao?.prazoMaximoGarantiaDias === "number"
        ? Number(configuracao.prazoMaximoGarantiaDias)
        : defaults.prazoMaximoGarantiaDias,
    exigirItemParaGarantia:
      typeof configuracao?.exigirItemParaGarantia === "boolean"
        ? Boolean(configuracao.exigirItemParaGarantia)
        : defaults.exigirItemParaGarantia,
    permitirGarantiaPersonalizada:
      typeof configuracao?.permitirGarantiaPersonalizada === "boolean"
        ? Boolean(configuracao.permitirGarantiaPersonalizada)
        : defaults.permitirGarantiaPersonalizada,
    textoCoberturaGarantia: normalizarTextoGarantia(configuracao?.textoCoberturaGarantia, TEXTO_COBERTURA_GARANTIA_PADRAO),
    textoExclusoesGarantia: normalizarTextoGarantia(configuracao?.textoExclusoesGarantia, TEXTO_EXCLUSOES_GARANTIA_PADRAO),
    textoResponsabilidadeDados: normalizarTextoGarantia(
      configuracao?.textoResponsabilidadeDados,
      TEXTO_RESPONSABILIDADE_DADOS_PADRAO
    ),
  };
}

function validarPrazoGarantiaConfigurado(
  valorInformado: number | null | undefined,
  regras: RegrasGarantiaAplicadas,
  prazoAtualOs?: number | null
): number {
  const prazoBase = typeof valorInformado === "number" && Number.isFinite(valorInformado)
    ? valorInformado
    : typeof prazoAtualOs === "number" && Number.isFinite(prazoAtualOs)
      ? prazoAtualOs
      : regras.prazoPadrao;

  const prazoInteiro = validarPrazoGarantiaDias(prazoBase);

  if (!regras.permitirGarantiaPersonalizada) {
    return regras.prazoPadrao;
  }

  if (prazoInteiro < regras.prazoMinimo || prazoInteiro > regras.prazoMaximo) {
    throw new Error("O prazo de garantia informado está fora do limite permitido nas configurações.");
  }

  return prazoInteiro;
}

export async function garantirTermoGarantiaPorOS(
  client: ClientTx,
  input: { osId: string; criadoPorId?: string; prazoGarantiaDias?: number }
): Promise<{
  termoGarantiaId: string;
  osId: string;
  prazoGarantiaDias: number;
  dataInicioGarantia: Date;
  dataFimGarantia: Date;
  criadoNovo: boolean;
}> {
  const osId = normalizarTexto(input.osId);
  if (!osId) {
    throw new Error("OS invalida para geracao de garantia.");
  }

  const os = await client.ordemServico.findUnique({
    where: { id: osId },
    select: {
      id: true,
      numeroOs: true,
      status: true,
      equipamento: true,
      marca: true,
      modelo: true,
      imei: true,
      relatoCliente: true,
      observacoes: true,
      atualizadoEm: true,
      excluidaEm: true,
      prazoGarantiaDias: true,
      cliente: {
        select: {
          nomeRazaoSocial: true,
          telefone: true,
          documento: true,
        },
      },
      itens: {
        select: {
          descricao: true,
          tipoPeca: true,
          valorCobrado: true,
        },
      },
      termoGarantia: {
        select: {
          id: true,
          prazoGarantiaDias: true,
          dataInicioGarantia: true,
          dataFimGarantia: true,
        },
      },
    },
  }) as OsTransacional | null;

  if (!os) {
    throw new Error("Ordem de servico nao encontrada.");
  }

  if (os.excluidaEm) {
    throw new Error("Nao e permitido gerar garantia para OS excluida.");
  }

  if (os.termoGarantia) {
    return {
      termoGarantiaId: os.termoGarantia.id,
      osId: os.id,
      prazoGarantiaDias: Number(os.termoGarantia.prazoGarantiaDias),
      dataInicioGarantia: os.termoGarantia.dataInicioGarantia,
      dataFimGarantia: os.termoGarantia.dataFimGarantia,
      criadoNovo: false,
    };
  }

  if (String(os.status) !== STATUS_PERMITE_GARANTIA) {
    throw new Error(MENSAGEM_ERRO_STATUS_GARANTIA);
  }

  let configuracao: ConfiguracaoTermo | null = null;

  try {
    configuracao = await client.configuracao.findFirst({
      orderBy: { criadoEm: "asc" },
      select: {
        nomeFantasia: true,
        razaoSocial: true,
        cnpj: true,
        telefone: true,
        logradouro: true,
        numero: true,
        bairro: true,
        cidade: true,
        estado: true,
        prazoGarantiaPadraoDias: true,
        prazoMinimoGarantiaDias: true,
        prazoMaximoGarantiaDias: true,
        exigirItemParaGarantia: true,
        permitirGarantiaPersonalizada: true,
        textoCoberturaGarantia: true,
        textoExclusoesGarantia: true,
        textoResponsabilidadeDados: true,
      },
    }) as ConfiguracaoTermo | null;
  } catch (erro) {
    if (!mensagemIndicaRuntimeLegadoConfiguracao(erro)) {
      throw erro;
    }

    try {
      const rows = await prisma.$queryRaw<Array<ConfiguracaoTermo>>`
        SELECT
          "nomeFantasia", "razaoSocial", "cnpj", "telefone",
          "logradouro", "numero", "bairro", "cidade", "estado",
          "prazoGarantiaPadraoDias", "prazoMinimoGarantiaDias", "prazoMaximoGarantiaDias",
          "exigirItemParaGarantia", "permitirGarantiaPersonalizada",
          "textoCoberturaGarantia", "textoExclusoesGarantia", "textoResponsabilidadeDados"
        FROM "Configuracao" ORDER BY "criadoEm" ASC LIMIT 1
      `;
      configuracao = rows[0] ?? null;
    } catch {
      configuracao = await client.configuracao.findFirst({
        orderBy: { criadoEm: "asc" },
        select: {
          nomeFantasia: true,
          razaoSocial: true,
          cnpj: true,
          telefone: true,
          logradouro: true,
          numero: true,
          bairro: true,
          cidade: true,
          estado: true,
        },
      }) as ConfiguracaoTermo | null;
    }
  }

  const regrasGarantia = obterRegrasGarantia(configuracao);

  if (regrasGarantia.exigirItemParaGarantia && (os.itens ?? []).length === 0) {
    throw new Error(MENSAGEM_ERRO_GARANTIA_SEM_ITENS);
  }

  const prazoGarantiaDias = validarPrazoGarantiaConfigurado(input.prazoGarantiaDias, regrasGarantia, os.prazoGarantiaDias);
  const dataInicioGarantia = new Date(os.atualizadoEm);
  const dataFimGarantia = adicionarDias(dataInicioGarantia, prazoGarantiaDias);
  const numeroOS = formatarNumeroOS(os.numeroOs);

  const servicosExecutados = montarServicosExecutados(
    os.itens.map((item) => ({ descricao: item.descricao, tipoPeca: String(item.tipoPeca) }))
  );

  const textoGarantia = montarTextoGarantia({
    numeroOS,
    dataFinalizacao: dataInicioGarantia.toLocaleDateString("pt-BR"),
    clienteNome: os.cliente.nomeRazaoSocial,
    equipamento: os.equipamento,
    servicosExecutados,
    prazoGarantiaDias,
    textoCoberturaGarantia: regrasGarantia.textoCoberturaGarantia,
    textoExclusoesGarantia: regrasGarantia.textoExclusoesGarantia,
    textoResponsabilidadeDados: regrasGarantia.textoResponsabilidadeDados,
  });

  const nomeEmpresa = normalizarTexto(configuracao?.nomeFantasia) || normalizarTexto(configuracao?.razaoSocial) || "Konext";
  const documentoEmpresa = normalizarTexto(configuracao?.cnpj);
  const telefoneEmpresa = normalizarTexto(configuracao?.telefone);
  const enderecoEmpresa = [
    normalizarTexto(configuracao?.logradouro),
    normalizarTexto(configuracao?.numero),
    normalizarTexto(configuracao?.bairro),
    normalizarTexto(configuracao?.cidade),
    normalizarTexto(configuracao?.estado),
  ]
    .filter((parte) => parte.length > 0)
    .join(", ");

  const termo = await client.termoGarantiaOS.create({
    data: {
      osId: os.id,
      prazoGarantiaDias,
      dataInicioGarantia,
      dataFimGarantia,
      textoGarantia: [
        `Empresa: ${nomeEmpresa}`,
        documentoEmpresa ? `Documento: ${documentoEmpresa}` : "",
        telefoneEmpresa ? `Telefone: ${telefoneEmpresa}` : "",
        enderecoEmpresa ? `Endereco: ${enderecoEmpresa}` : "",
        "",
        textoGarantia,
      ]
        .filter((linha) => linha.length > 0)
        .join("\n"),
      criadoPorId: input.criadoPorId ? String(input.criadoPorId) : null,
    },
    select: { id: true },
  });

  await client.ordemServico.update({
    where: { id: os.id },
    data: { prazoGarantiaDias },
  });

  return {
    termoGarantiaId: termo.id,
    osId: os.id,
    prazoGarantiaDias,
    dataInicioGarantia,
    dataFimGarantia,
    criadoNovo: true,
  };
}

export async function gerarTermoGarantiaOS(input: GerarTermoGarantiaOSInput): Promise<ResultadoGerarGarantia> {
  try {
    const usuario = await exigirSessao();
    const osId = normalizarTexto(input.osId);

    if (!osId) {
      return { sucesso: false, erro: "Ordem de servico nao encontrada." };
    }

    const prazoGarantiaDiasInformado = Number(input.prazoGarantiaDias);
    const prazoGarantiaDias = Number.isFinite(prazoGarantiaDiasInformado) ? prazoGarantiaDiasInformado : undefined;

    const termoGerado = await prisma.$transaction(async (tx) => {
      const resultado = await garantirTermoGarantiaPorOS(tx, {
        osId,
        criadoPorId: String(usuario.id),
        prazoGarantiaDias,
      });

      await registrarLogAuditoria(
        tx,
        contextoAuditoriaDoUsuario(usuario, "app/actions/garantias.ts:gerarTermoGarantiaOS"),
        {
          acao: ACOES_AUDITORIA.GERAR_TERMO_GARANTIA,
          entidade: ENTIDADES_AUDITORIA.TERMO_GARANTIA_OS,
          entidadeId: resultado.termoGarantiaId,
          dadosDepois: {
            osId: resultado.osId,
            prazoGarantiaDias: resultado.prazoGarantiaDias,
            dataInicioGarantia: resultado.dataInicioGarantia.toISOString(),
            dataFimGarantia: resultado.dataFimGarantia.toISOString(),
            termoGarantiaId: resultado.termoGarantiaId,
            criadoNovo: resultado.criadoNovo,
          },
        }
      );

      return resultado;
    });

    revalidatePath("/os");
    revalidatePath(`/os/${osId}`);
    revalidatePath(`/os/${osId}/garantia`);
    revalidatePath("/os/garantias");
    revalidatePath("/");
    revalidatePath("/dashboard");

    return {
      sucesso: true,
      mensagem: "Termo de garantia gerado com sucesso.",
      osId,
      termoGarantiaId: termoGerado.termoGarantiaId,
    };
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : "";

    if (
      mensagem === MENSAGEM_ERRO_STATUS_GARANTIA ||
      mensagem === MENSAGEM_ERRO_GARANTIA_SEM_ITENS ||
      mensagem === MENSAGEM_PRAZO_OBRIGATORIO ||
      mensagem === MENSAGEM_PRAZO_INVALIDO ||
      mensagem === "O prazo de garantia informado está fora do limite permitido nas configurações." ||
      mensagem === "Ordem de servico nao encontrada." ||
      mensagem === "Nao e permitido gerar garantia para OS excluida."
    ) {
      return { sucesso: false, erro: mensagem };
    }

    if (mensagem.includes("Sess")) {
      return { sucesso: false, erro: mensagem };
    }

    console.error("[garantia] falha ao gerar termo", {
      osId: input.osId,
      erro: mensagem || "erro-desconhecido",
    });

    return {
      sucesso: false,
      erro: MENSAGEM_ERRO_GERAR_GARANTIA,
    };
  }
}

export async function obterContextoGarantiaOS(osId: string): Promise<ContextoGarantiaOS | null> {
  const usuario = await exigirSessao();
  if (!usuario?.id) return null;

  const idNormalizado = normalizarTexto(osId);
  if (!idNormalizado) return null;

  const os = await prisma.ordemServico.findUnique({
    where: { id: idNormalizado },
    select: {
      id: true,
      numeroOs: true,
      status: true,
      excluidaEm: true,
      termoGarantia: {
        select: {
          id: true,
        },
      },
      _count: {
        select: {
          itens: true,
        },
      },
    },
  });

  if (!os || os.excluidaEm) return null;

  return {
    osId: os.id,
    numeroOS: formatarNumeroOS(os.numeroOs),
    statusOS: String(os.status),
    possuiTermoGarantia: Boolean(os.termoGarantia),
    possuiItens: Number(os._count?.itens ?? 0) > 0,
  };
}

export async function obterTermoGarantiaOS(osId: string): Promise<DadosTermoGarantia | null> {
  const usuario = await exigirSessao();
  if (!usuario?.id) return null;

  const idNormalizado = normalizarTexto(osId);
  if (!idNormalizado) return null;

  const termo = await prisma.termoGarantiaOS.findUnique({
    where: { osId: idNormalizado },
    select: {
      id: true,
      prazoGarantiaDias: true,
      dataInicioGarantia: true,
      dataFimGarantia: true,
      textoGarantia: true,
      os: {
        select: {
          id: true,
          numeroOs: true,
          equipamento: true,
          marca: true,
          modelo: true,
          imei: true,
          relatoCliente: true,
          observacoes: true,
          excluidaEm: true,
          cliente: {
            select: {
              nomeRazaoSocial: true,
              telefone: true,
              documento: true,
            },
          },
          itens: {
            select: {
              descricao: true,
              tipoPeca: true,
              valorCobrado: true,
            },
          },
        },
      },
    },
  });

  if (!termo || termo.os.excluidaEm) return null;

  let config: {
    nomeFantasia?: string | null;
    razaoSocial?: string | null;
    cnpj?: string | null;
    telefone?: string | null;
    logradouro?: string | null;
    numero?: string | null;
    bairro?: string | null;
    cidade?: string | null;
    estado?: string | null;
    logoUrl?: string | null;
    textoCoberturaGarantia?: string | null;
    textoExclusoesGarantia?: string | null;
    textoResponsabilidadeDados?: string | null;
  } | null = null;

  try {
    config = await prisma.configuracao.findFirst({
      orderBy: { criadoEm: "asc" },
      select: {
        nomeFantasia: true,
        razaoSocial: true,
        cnpj: true,
        telefone: true,
        logradouro: true,
        numero: true,
        bairro: true,
        cidade: true,
        estado: true,
        logoUrl: true,
        textoCoberturaGarantia: true,
        textoExclusoesGarantia: true,
        textoResponsabilidadeDados: true,
      },
    });
  } catch (erro) {
    if (!mensagemIndicaRuntimeLegadoConfiguracao(erro)) {
      throw erro;
    }

    try {
      const rows = await prisma.$queryRaw<Array<typeof config>>`
        SELECT
          "nomeFantasia", "razaoSocial", "cnpj", "telefone",
          "logradouro", "numero", "bairro", "cidade", "estado", "logoUrl",
          "textoCoberturaGarantia", "textoExclusoesGarantia", "textoResponsabilidadeDados"
        FROM "Configuracao" ORDER BY "criadoEm" ASC LIMIT 1
      `;
      config = rows[0] ?? null;
    } catch {
      config = await prisma.configuracao.findFirst({
        orderBy: { criadoEm: "asc" },
        select: {
          nomeFantasia: true,
          razaoSocial: true,
          cnpj: true,
          telefone: true,
          logradouro: true,
          numero: true,
          bairro: true,
          cidade: true,
          estado: true,
          logoUrl: true,
        },
      });
    }
  }

  const servicosExecutados = montarServicosExecutados(
    termo.os.itens.map((item) => ({ descricao: item.descricao, tipoPeca: String(item.tipoPeca) }))
  );
  const valorCobrado = termo.os.itens.reduce((acc, item) => acc + Number(item.valorCobrado ?? 0), 0);

  return {
    termoGarantiaId: termo.id,
    osId: termo.os.id,
    numeroOS: formatarNumeroOS(termo.os.numeroOs),
    dataFinalizacao: termo.dataInicioGarantia.toISOString(),
    clienteNome: termo.os.cliente.nomeRazaoSocial,
    clienteTelefone: termo.os.cliente.telefone,
    clienteDocumento: termo.os.cliente.documento,
    equipamento: termo.os.equipamento,
    marcaModelo: [normalizarTexto(termo.os.marca), normalizarTexto(termo.os.modelo)].filter(Boolean).join(" / ") || null,
    imeiOuSerial: termo.os.imei,
    defeitoRelatado: termo.os.relatoCliente,
    diagnosticoTecnico: termo.os.observacoes,
    servicosExecutados,
    valorCobrado,
    prazoGarantiaDias: termo.prazoGarantiaDias,
    dataFimGarantia: termo.dataFimGarantia.toISOString(),
    textoGarantia: termo.textoGarantia,
    textoCoberturaGarantia: normalizarTextoGarantia(config?.textoCoberturaGarantia, TEXTO_COBERTURA_GARANTIA_PADRAO),
    textoExclusoesGarantia: normalizarTextoGarantia(config?.textoExclusoesGarantia, TEXTO_EXCLUSOES_GARANTIA_PADRAO),
    textoResponsabilidadeDados: normalizarTextoGarantia(
      config?.textoResponsabilidadeDados,
      TEXTO_RESPONSABILIDADE_DADOS_PADRAO
    ),
    empresa: {
      nome: normalizarTexto(config?.nomeFantasia) || normalizarTexto(config?.razaoSocial) || "Konext",
      documento: normalizarTexto(config?.cnpj) || null,
      telefone: normalizarTexto(config?.telefone) || null,
      logoUrl: normalizarTexto(config?.logoUrl) || null,
      endereco: [
        normalizarTexto(config?.logradouro),
        normalizarTexto(config?.numero),
        normalizarTexto(config?.bairro),
        normalizarTexto(config?.cidade),
        normalizarTexto(config?.estado),
      ]
        .filter((item) => item.length > 0)
        .join(", ") || null,
    },
  };
}

export async function listarGarantiasOS(filtros: FiltrosGarantiaInput = {}): Promise<ListagemGarantiasOS> {
  const usuario = await exigirSessao();
  if (!usuario?.id) {
    return { sucesso: false, erro: "Sessao expirada ou invalida. Faca login novamente." };
  }

  try {
    const pagina = Math.max(1, Number(filtros.pagina ?? 1));
    const tamanhoPagina = Math.min(100, Math.max(1, Number(filtros.tamanhoPagina ?? 20)));
    const termoBusca = normalizarTexto(filtros.busca);
    const inicioFiltro = filtros.dataInicio ? inicioDoDia(new Date(filtros.dataInicio)) : null;
    const fimFiltro = filtros.dataFim ? fimDoDia(new Date(filtros.dataFim)) : null;

    const whereBase: Prisma.TermoGarantiaOSWhereInput = {
      os: {
        is: {},
      },
      ...(inicioFiltro || fimFiltro
        ? {
            dataInicioGarantia: {
              ...(inicioFiltro ? { gte: inicioFiltro } : {}),
              ...(fimFiltro ? { lte: fimFiltro } : {}),
            },
          }
        : {}),
      ...(termoBusca.length > 0
        ? {
            OR: [
              {
                os: {
                  cliente: {
                    nomeRazaoSocial: { contains: termoBusca, mode: "insensitive" },
                  },
                },
              },
              {
                os: {
                  cliente: {
                    telefone: { contains: termoBusca, mode: "insensitive" },
                  },
                },
              },
              {
                os: {
                  equipamento: { contains: termoBusca, mode: "insensitive" },
                },
              },
              {
                os: {
                  modelo: { contains: termoBusca, mode: "insensitive" },
                },
              },
              {
                os: {
                  imei: { contains: termoBusca, mode: "insensitive" },
                },
              },
              ...(Number.isFinite(Number(termoBusca))
                ? [
                    {
                      os: {
                        numeroOs: Number(termoBusca),
                      },
                    },
                  ]
                : []),
            ],
          }
        : {}),
    };

    const [termos, total] = await Promise.all([
      prisma.termoGarantiaOS.findMany({
        where: whereBase,
        orderBy: { dataFimGarantia: "asc" },
        skip: (pagina - 1) * tamanhoPagina,
        take: tamanhoPagina,
        select: {
          id: true,
          dataInicioGarantia: true,
          dataFimGarantia: true,
          prazoGarantiaDias: true,
          canceladaEm: true,
          os: {
            select: {
              id: true,
              numeroOs: true,
              equipamento: true,
              marca: true,
              modelo: true,
              imei: true,
              excluidaEm: true,
              cliente: {
                select: {
                  nomeRazaoSocial: true,
                  telefone: true,
                  documento: true,
                },
              },
              itens: {
                select: {
                  descricao: true,
                  tipoPeca: true,
                  valorCobrado: true,
                },
              },
            },
          },
          retornos: {
            select: {
              id: true,
              criadoEm: true,
              motivo: true,
              resultado: true,
              finalizadoEm: true,
              osRetorno: {
                select: {
                  id: true,
                  numeroOs: true,
                },
              },
            },
            orderBy: {
              criadoEm: "desc",
            },
          },
        },
      }),
      prisma.termoGarantiaOS.count({ where: whereBase }),
    ]);

    const hoje = new Date();

    let linhas = termos.map((termo): LinhaGarantiaOS => {
      const quantidadeRetornos = termo.retornos.length;
      const ultimoRetorno = termo.retornos[0] ?? null;
      const retornoEmAndamento = termo.retornos.some((retorno) => !retorno.finalizadoEm);
      const cancelada = Boolean(termo.canceladaEm) || Boolean(termo.os.excluidaEm);
      const statusGarantia = calcularStatusGarantia({
        cancelada,
        dataFimGarantia: termo.dataFimGarantia,
        retornoEmAndamento,
        quantidadeRetornos,
        ultimoResultadoRetorno: ultimoRetorno?.resultado ?? null,
      });
      const valorCobrado = termo.os.itens.reduce((acc, item) => acc + Number(item.valorCobrado ?? 0), 0);
      const servicos = montarServicosExecutados(
        termo.os.itens.map((item) => ({ descricao: item.descricao, tipoPeca: String(item.tipoPeca) }))
      );

      return {
        termoGarantiaId: termo.id,
        osId: termo.os.id,
        numeroOS: formatarNumeroOS(termo.os.numeroOs),
        clienteNome: termo.os.cliente.nomeRazaoSocial,
        clienteTelefone: termo.os.cliente.telefone,
        clienteDocumento: termo.os.cliente.documento,
        equipamento: termo.os.equipamento,
        marcaModelo: [normalizarTexto(termo.os.marca), normalizarTexto(termo.os.modelo)].filter(Boolean).join(" / ") || null,
        imeiOuSerial: termo.os.imei,
        servicosExecutados: servicos,
        pecasOuServicos: termo.os.itens.map((item) => normalizarTexto(item.descricao)).filter((item) => item.length > 0),
        valorCobrado,
        dataFinalizacao: termo.dataInicioGarantia.toISOString(),
        prazoGarantiaDias: termo.prazoGarantiaDias,
        dataFimGarantia: termo.dataFimGarantia.toISOString(),
        diasRestantes: diferencaDias(hoje, termo.dataFimGarantia),
        statusGarantia,
        teveRetorno: quantidadeRetornos > 0,
        retornoEmAndamento,
        quantidadeRetornos,
        ultimoRetornoEm: ultimoRetorno ? ultimoRetorno.criadoEm.toISOString() : null,
        ultimoMotivoRetorno: ultimoRetorno ? ultimoRetorno.motivo : null,
        ultimoResultadoRetorno: ultimoRetorno?.resultado ?? null,
        osRetornoId: ultimoRetorno?.osRetorno?.id ?? null,
        numeroOSRetorno: ultimoRetorno?.osRetorno ? formatarNumeroOS(ultimoRetorno.osRetorno.numeroOs) : null,
      };
    });

    if (filtros.retorno === "COM_RETORNO") {
      linhas = linhas.filter((linha) => linha.teveRetorno);
    }

    if (filtros.retorno === "SEM_RETORNO") {
      linhas = linhas.filter((linha) => !linha.teveRetorno);
    }

    if (filtros.vencimentoProximo) {
      linhas = linhas.filter((linha) => linha.statusGarantia === "PERTO_DO_VENCIMENTO");
    }

    if (filtros.status && filtros.status !== "TODAS") {
      linhas = linhas.filter((linha) => linha.statusGarantia === filtros.status);
    }

    return {
      sucesso: true,
      dados: linhas,
      total,
      pagina,
      totalPaginas: Math.max(1, Math.ceil(total / tamanhoPagina)),
    };
  } catch {
    return {
      sucesso: false,
      erro: "Nao foi possivel listar as garantias. Tente novamente.",
    };
  }
}

export async function obterDashboardGarantiasOS(): Promise<DashboardGarantiasOS> {
  await exigirSessao();

  const hoje = inicioDoDia();
  const limite7 = fimDoDia(adicionarDias(hoje, 7));

  const [ativas, vencem7, vencidas, comRetorno, totalBase, valorAtivoRaw, principaisServicos, principaisPecas] = await Promise.all([
    prisma.termoGarantiaOS.count({
      where: {
        canceladaEm: null,
        os: { excluidaEm: null },
        dataFimGarantia: { gte: hoje },
      },
    }),
    prisma.termoGarantiaOS.count({
      where: {
        canceladaEm: null,
        os: { excluidaEm: null },
        dataFimGarantia: { gte: hoje, lte: limite7 },
      },
    }),
    prisma.termoGarantiaOS.count({
      where: {
        canceladaEm: null,
        os: { excluidaEm: null },
        dataFimGarantia: { lt: hoje },
      },
    }),
    prisma.termoGarantiaOS.count({
      where: {
        canceladaEm: null,
        os: { excluidaEm: null },
        retornos: { some: {} },
      },
    }),
    prisma.termoGarantiaOS.count({
      where: {
        canceladaEm: null,
        os: { excluidaEm: null },
      },
    }),
    prisma.$queryRaw<Array<{ total: number | null }>>`
      SELECT COALESCE(SUM(i."valorCobrado"), 0) AS total
      FROM "TermoGarantiaOS" tg
      INNER JOIN "OrdemServico" os ON os.id = tg."osId"
      INNER JOIN "ItemOS" i ON i."osId" = os.id
      WHERE tg."canceladaEm" IS NULL
        AND os."excluidaEm" IS NULL
        AND tg."dataFimGarantia" >= ${hoje}
    `,
    prisma.$queryRaw<Array<{ nome: string | null; quantidade: bigint }>>`
      SELECT i.descricao AS nome, COUNT(r.id) AS quantidade
      FROM "RetornoGarantiaOS" r
      INNER JOIN "TermoGarantiaOS" tg ON tg.id = r."termoGarantiaId"
      INNER JOIN "OrdemServico" os ON os.id = tg."osId"
      INNER JOIN "ItemOS" i ON i."osId" = os.id
      WHERE tg."canceladaEm" IS NULL
        AND os."excluidaEm" IS NULL
      GROUP BY i.descricao
      ORDER BY COUNT(r.id) DESC
      LIMIT 5
    `,
    prisma.$queryRaw<Array<{ nome: string | null; quantidade: bigint }>>`
      SELECT i."tipoPeca"::text AS nome, COUNT(r.id) AS quantidade
      FROM "RetornoGarantiaOS" r
      INNER JOIN "TermoGarantiaOS" tg ON tg.id = r."termoGarantiaId"
      INNER JOIN "OrdemServico" os ON os.id = tg."osId"
      INNER JOIN "ItemOS" i ON i."osId" = os.id
      WHERE tg."canceladaEm" IS NULL
        AND os."excluidaEm" IS NULL
      GROUP BY i."tipoPeca"
      ORDER BY COUNT(r.id) DESC
      LIMIT 5
    `,
  ]);

  const valorEmGarantia = Number(valorAtivoRaw[0]?.total ?? 0);

  return {
    garantiasAtivas: ativas,
    vencemEm7Dias: vencem7,
    garantiasVencidas: vencidas,
    comRetorno,
    taxaRetorno: totalBase > 0 ? Number(((comRetorno / totalBase) * 100).toFixed(2)) : 0,
    valorEmGarantia,
    principaisServicosEmRetorno: principaisServicos.map((item) => ({
      nome: normalizarTexto(item.nome) || "Servico nao informado",
      quantidade: Number(item.quantidade ?? 0),
    })),
    pecasComMaisRetorno: principaisPecas.map((item) => ({
      nome: normalizarTexto(item.nome).replaceAll("_", " ") || "Peca nao informada",
      quantidade: Number(item.quantidade ?? 0),
    })),
  };
}

export async function registrarRetornoGarantiaOS(input: RegistrarRetornoGarantiaInput): Promise<ResultadoAcao> {
  try {
    const usuario = await exigirSessao();

    const termoGarantiaId = normalizarTexto(input.termoGarantiaId);
    const motivo = normalizarTexto(input.motivo);
    const descricao = normalizarTexto(input.descricao);
    const analiseTecnica = normalizarTexto(input.analiseTecnica);

    if (!termoGarantiaId) {
      return { sucesso: false, erro: "Termo de garantia invalido." };
    }

    if (motivo.length < 2 || motivo.length > 200) {
      return { sucesso: false, erro: "Motivo do retorno invalido." };
    }

    if (descricao.length < 5 || descricao.length > 1000) {
      return { sucesso: false, erro: "Descricao do retorno invalida." };
    }

    if (analiseTecnica.length > 1000) {
      return { sucesso: false, erro: "Analise tecnica excede o limite permitido." };
    }

    const resultadosValidos: ResultadoRetornoGarantia[] = [
      "PROCEDENTE",
      "IMPROCEDENTE",
      "SEM_GARANTIA",
      "RESOLVIDO_SEM_TROCA",
      "TROCA_REALIZADA",
      "COBRANCA_ADICIONAL",
      "EM_ANALISE",
    ];
    if (!resultadosValidos.includes(input.resultado)) {
      return { sucesso: false, erro: "Resultado do retorno invalido." };
    }

    const transacao = await prisma.$transaction(async (tx) => {
      const termo = await tx.termoGarantiaOS.findUnique({
        where: { id: termoGarantiaId },
        select: {
          id: true,
          osId: true,
          canceladaEm: true,
          os: {
            select: {
              id: true,
              numeroOs: true,
              clienteId: true,
              equipamento: true,
              marca: true,
              modelo: true,
              imei: true,
              senha: true,
              senhaDesenho: true,
              condicaoFisica: true,
              acessorios: true,
              excluidaEm: true,
            },
          },
        },
      });

      if (!termo) {
        throw new Error("TERMO_NAO_ENCONTRADO");
      }

      if (termo.canceladaEm || termo.os.excluidaEm) {
        throw new Error("GARANTIA_CANCELADA");
      }

      const retornoAberto = await tx.retornoGarantiaOS.findFirst({
        where: {
          termoGarantiaId: termo.id,
          finalizadoEm: null,
        },
        select: {
          id: true,
        },
      });

      if (retornoAberto) {
        throw new Error("RETORNO_EM_ANDAMENTO");
      }

      const osRetorno = await tx.ordemServico.create({
        data: {
          clienteId: termo.os.clienteId,
          equipamento: termo.os.equipamento,
          marca: termo.os.marca,
          modelo: termo.os.modelo,
          imei: termo.os.imei,
          senha: termo.os.senha,
          senhaDesenho: termo.os.senhaDesenho,
          relatoCliente: `Retorno de garantia da ${formatarNumeroOS(termo.os.numeroOs)}: ${descricao}`,
          condicaoFisica: termo.os.condicaoFisica,
          acessorios: termo.os.acessorios,
          status: "GARANTIA_RETORNO",
          observacoes: `Motivo do retorno: ${motivo}`,
          ehRetornoGarantia: true,
          osOrigemGarantiaId: termo.os.id,
        },
        select: {
          id: true,
          numeroOs: true,
        },
      });

      const retorno = await tx.retornoGarantiaOS.create({
        data: {
          termoGarantiaId: termo.id,
          osOrigemId: termo.osId,
          osRetornoId: osRetorno.id,
          motivo,
          descricao,
          analiseTecnica: analiseTecnica.length > 0 ? analiseTecnica : null,
          resultado: input.resultado,
          houveTroca: false,
          houveCobranca: false,
          criadoPorId: String(usuario.id),
        },
        select: {
          id: true,
          osOrigemId: true,
          osRetornoId: true,
        },
      });

      await tx.ordemServico.update({
        where: { id: osRetorno.id },
        data: { retornoGarantiaId: retorno.id },
      });

      await registrarLogAuditoria(
        tx,
        contextoAuditoriaDoUsuario(usuario, "app/actions/garantias.ts:registrarRetornoGarantiaOS"),
        {
          acao: ACOES_AUDITORIA.REGISTRAR_RETORNO_GARANTIA,
          entidade: ENTIDADES_AUDITORIA.RETORNO_GARANTIA_OS,
          entidadeId: retorno.id,
          dadosAntes: {
            termoGarantiaId: termo.id,
            osOrigemId: termo.os.id,
            retornoAberto: false,
          },
          dadosDepois: {
            osRetornoId: osRetorno.id,
            motivo,
            descricao,
            analiseTecnica,
            resultado: input.resultado,
          },
        }
      );

      return {
        retornoId: retorno.id,
        osOrigemId: retorno.osOrigemId,
        osRetornoId: retorno.osRetornoId,
        numeroOsRetorno: osRetorno.numeroOs,
      };
    });

    revalidatePath("/");
    revalidatePath("/os");
    revalidatePath("/os/garantias");
    if (transacao.osOrigemId) {
      revalidatePath(`/os/${transacao.osOrigemId}`);
      revalidatePath(`/os/${transacao.osOrigemId}/garantia`);
    }
    if (transacao.osRetornoId) {
      revalidatePath(`/os/${transacao.osRetornoId}`);
    }
    revalidatePath("/financeiro");

    return {
      sucesso: true,
      mensagem: `Retorno registrado com sucesso. Nova OS de retorno criada: ${formatarNumeroOS(transacao.numeroOsRetorno)}.`,
    };
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : "";

    if (mensagem === "TERMO_NAO_ENCONTRADO") {
      return { sucesso: false, erro: "Garantia nao encontrada." };
    }

    if (mensagem === "GARANTIA_CANCELADA") {
      return { sucesso: false, erro: "Nao e permitido registrar retorno para garantia cancelada." };
    }

    if (mensagem === "RETORNO_EM_ANDAMENTO") {
      return { sucesso: false, erro: "Já existe um retorno de garantia em andamento para esta OS." };
    }

    return {
      sucesso: false,
      erro: "Nao foi possivel registrar o retorno. Tente novamente.",
    };
  }
}

export async function finalizarRetornoGarantiaOS(input: FinalizarRetornoGarantiaInput): Promise<ResultadoAcao> {
  try {
    const usuario = await exigirSessao();

    const retornoGarantiaId = normalizarTexto(input.retornoGarantiaId);
    const analiseTecnica = normalizarTexto(input.analiseTecnica);
    const descricaoServico = normalizarTexto(input.descricaoServico);
    const pecasAdicionais = normalizarTexto(input.pecasAdicionais);
    const observacoesTecnicas = normalizarTexto(input.observacoesTecnicas);
    const houveTroca = Boolean(input.houveTroca);
    const houveCobranca = Boolean(input.houveCobranca);
    const valorAdicional = Number(input.valorAdicional ?? 0);

    if (!retornoGarantiaId) {
      return { sucesso: false, erro: "Retorno de garantia invalido." };
    }

    if (analiseTecnica.length > 1000 || descricaoServico.length > 1000 || pecasAdicionais.length > 1000 || observacoesTecnicas.length > 1000) {
      return { sucesso: false, erro: "Um dos campos excede o limite permitido de 1000 caracteres." };
    }

    const resultadosPermitidos: Array<Exclude<ResultadoRetornoGarantia, "EM_ANALISE">> = [
      "PROCEDENTE",
      "IMPROCEDENTE",
      "SEM_GARANTIA",
      "RESOLVIDO_SEM_TROCA",
      "TROCA_REALIZADA",
      "COBRANCA_ADICIONAL",
    ];

    if (!resultadosPermitidos.includes(input.resultado)) {
      return { sucesso: false, erro: "Resultado de finalizacao invalido." };
    }

    if (houveCobranca && (!Number.isFinite(valorAdicional) || valorAdicional <= 0)) {
      return { sucesso: false, erro: "Informe um valor adicional valido para cobrança." };
    }

    const retornoFinalizado = await prisma.$transaction(async (tx) => {
      const retorno = await tx.retornoGarantiaOS.findUnique({
        where: { id: retornoGarantiaId },
        select: {
          id: true,
          finalizadoEm: true,
          osRetornoId: true,
          osOrigemId: true,
          termoGarantia: {
            select: {
              os: {
                select: {
                  clienteId: true,
                },
              },
            },
          },
          osRetorno: {
            select: {
              id: true,
              numeroOs: true,
              archivedAt: true,
              status: true,
            },
          },
        },
      });

      if (!retorno) {
        throw new Error("RETORNO_NAO_ENCONTRADO");
      }

      if (retorno.finalizadoEm) {
        throw new Error("RETORNO_JA_FINALIZADO");
      }

      if (!retorno.osRetorno?.id) {
        throw new Error("OS_RETORNO_NAO_ENCONTRADA");
      }

      await tx.retornoGarantiaOS.update({
        where: { id: retorno.id },
        data: {
          resultado: input.resultado,
          analiseTecnica: analiseTecnica.length > 0 ? analiseTecnica : null,
          descricaoServico: descricaoServico.length > 0 ? descricaoServico : null,
          pecasAdicionais: pecasAdicionais.length > 0 ? pecasAdicionais : null,
          houveTroca,
          houveCobranca,
          valorAdicional: houveCobranca && valorAdicional > 0 ? valorAdicional : null,
          observacoesTecnicas: observacoesTecnicas.length > 0 ? observacoesTecnicas : null,
          finalizadoEm: new Date(),
          finalizadoPorId: String(usuario.id),
        },
      });

      if (!retorno.osRetorno.archivedAt && String(retorno.osRetorno.status) === "ENTREGUE") {
        await tx.ordemServico.update({
          where: { id: retorno.osRetorno.id },
          data: {
            archivedAt: new Date(),
          },
        });
      }

      if (houveCobranca && valorAdicional > 0) {
        await tx.contaReceber.create({
          data: {
            descricao: `Retorno de garantia OS #${String(retorno.osRetorno.numeroOs)} - cobrança adicional`,
            valor: valorAdicional,
            clienteId: retorno.termoGarantia.os.clienteId,
            ordemServicoId: retorno.osRetorno.id,
            dataVencimento: new Date(),
            status: "PENDENTE",
            formaRecebimento: "PIX",
            origem: "ORDEM_SERVICO",
          },
        });
      }

      await registrarLogAuditoria(
        tx,
        contextoAuditoriaDoUsuario(usuario, "app/actions/garantias.ts:finalizarRetornoGarantiaOS"),
        {
          acao: ACOES_AUDITORIA.FINALIZAR_RETORNO_GARANTIA,
          entidade: ENTIDADES_AUDITORIA.RETORNO_GARANTIA_OS,
          entidadeId: retorno.id,
          dadosAntes: {
            finalizadoEm: retorno.finalizadoEm,
            resultadoAnterior: "EM_ANALISE",
          },
          dadosDepois: {
            resultado: input.resultado,
            analiseTecnica,
            descricaoServico,
            pecasAdicionais,
            houveTroca,
            houveCobranca,
            valorAdicional: houveCobranca ? valorAdicional : 0,
            observacoesTecnicas,
            osRetornoId: retorno.osRetorno.id,
          },
        }
      );

      return {
        osRetornoId: retorno.osRetorno.id,
        osOrigemId: retorno.osOrigemId,
      };
    });

    revalidatePath("/");
    revalidatePath("/os");
    revalidatePath("/os/garantias");
    revalidatePath("/financeiro");
    if (retornoFinalizado.osRetornoId) {
      revalidatePath(`/os/${retornoFinalizado.osRetornoId}`);
      revalidatePath(`/os/${retornoFinalizado.osRetornoId}/garantia`);
    }
    if (retornoFinalizado.osOrigemId) {
      revalidatePath(`/os/${retornoFinalizado.osOrigemId}`);
      revalidatePath(`/os/${retornoFinalizado.osOrigemId}/garantia`);
    }

    return { sucesso: true, mensagem: "Retorno de garantia finalizado com sucesso." };
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : "";

    if (mensagem === "RETORNO_NAO_ENCONTRADO") {
      return { sucesso: false, erro: "Retorno de garantia nao encontrado." };
    }

    if (mensagem === "RETORNO_JA_FINALIZADO") {
      return { sucesso: false, erro: "Este retorno de garantia ja foi finalizado." };
    }

    if (mensagem === "OS_RETORNO_NAO_ENCONTRADA") {
      return { sucesso: false, erro: "OS de retorno nao encontrada para finalizacao." };
    }

    return { sucesso: false, erro: "Nao foi possivel finalizar o retorno de garantia." };
  }
}

export async function obterHistoricoConsertosCliente(input: {
  termoGarantiaId?: string;
  osId?: string;
}): Promise<HistoricoConsertoCliente[]> {
  await exigirSessao();

  const osIdNormalizado = normalizarTexto(input.osId);
  const termoIdNormalizado = normalizarTexto(input.termoGarantiaId);

  if (!osIdNormalizado && !termoIdNormalizado) return [];

  const osBase = termoIdNormalizado
    ? (
        await prisma.termoGarantiaOS.findUnique({
          where: { id: termoIdNormalizado },
          select: {
            os: {
              select: {
                id: true,
                clienteId: true,
                imei: true,
                equipamento: true,
                modelo: true,
              },
            },
          },
        })
      )?.os ?? null
    : await prisma.ordemServico.findUnique({
        where: { id: osIdNormalizado },
        select: {
          id: true,
          clienteId: true,
          imei: true,
          equipamento: true,
          modelo: true,
        },
      });
  if (!osBase) return [];

  const imeiBase = normalizarTexto(osBase.imei);
  const equipamentoBase = normalizarTexto(osBase.equipamento);
  const modeloBase = normalizarTexto(osBase.modelo);

  let whereHistorico: Prisma.OrdemServicoWhereInput;

  if (imeiBase.length > 0) {
    whereHistorico = {
      imei: imeiBase,
      excluidaEm: null,
    };
  } else if (equipamentoBase.length > 0 || modeloBase.length > 0) {
    whereHistorico = {
      clienteId: osBase.clienteId,
      excluidaEm: null,
      equipamento: equipamentoBase.length > 0 ? equipamentoBase : undefined,
      modelo: modeloBase.length > 0 ? modeloBase : undefined,
    };
  } else {
    whereHistorico = {
      clienteId: osBase.clienteId,
      excluidaEm: null,
    };
  }

  const historico = await prisma.ordemServico.findMany({
    where: whereHistorico,
    orderBy: {
      criadoEm: "desc",
    },
    take: 30,
    select: {
      id: true,
      numeroOs: true,
      criadoEm: true,
      equipamento: true,
      relatoCliente: true,
      observacoes: true,
      status: true,
      itens: {
        select: {
          descricao: true,
          tipoPeca: true,
          valorCobrado: true,
        },
      },
      termoGarantia: {
        select: {
          id: true,
          retornos: {
            select: { id: true },
          },
        },
      },
    },
  });

  return historico.map((os) => {
    const servicosExecutados = montarServicosExecutados(
      os.itens.map((item) => ({ descricao: item.descricao, tipoPeca: String(item.tipoPeca) }))
    );

    return {
      osId: os.id,
      numeroOS: formatarNumeroOS(os.numeroOs),
      data: os.criadoEm.toISOString(),
      equipamento: os.equipamento,
      defeitoRelatado: os.relatoCliente,
      diagnosticoTecnico: os.observacoes,
      servicosExecutados,
      pecasSubstituidas: os.itens.map((item) => normalizarTexto(item.descricao)).filter((item) => item.length > 0),
      valorCobrado: os.itens.reduce((acc, item) => acc + Number(item.valorCobrado ?? 0), 0),
      statusFinal: String(os.status),
      gerouGarantia: Boolean(os.termoGarantia),
      teveRetorno: Boolean(os.termoGarantia?.retornos.length),
    };
  });
}
