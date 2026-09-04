import "dotenv/config";
import { existsSync, readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { PrismaClient as PrismaOperacional } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";

if (typeof WebSocket === "undefined") {
  neonConfig.webSocketConstructor = ws;
}

// ==========================================
// GUARDAS DE AMBIENTE
// ==========================================
const ARQUIVO_ENV_TESTE = ".env.teste";
const SEMENTE = 20260903;
// Toda linha criada por este seed nasce com este prefixo no proprio id (colunas `id` sao String @id).
// E o unico criterio usado pelo --reset: linha sem o prefixo nunca e tocada.
const PREFIXO_DEMO = "seed-demo-";
const HORA_MS = 60 * 60 * 1000;
const DIA_MS = 24 * HORA_MS;
const AGORA = new Date();

function idDemo() {
  return `${PREFIXO_DEMO}${randomUUID()}`;
}

function extrairHost(connectionString) {
  try {
    return new URL(connectionString).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function mascarar(connectionString) {
  try {
    const url = new URL(connectionString);
    return `postgresql://${url.username}:***@${url.hostname}${url.pathname}`;
  } catch {
    return "postgresql://***";
  }
}

function lerVariavelDeArquivoEnv(caminho, nomeVariavel) {
  if (!existsSync(caminho)) return null;

  try {
    const conteudo = readFileSync(caminho, "utf8");
    const match = conteudo.match(new RegExp(`^${nomeVariavel}\\s*=\\s*"?([^"\\n]+)"?\\s*$`, "m"));
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

function validarAmbienteDeTeste() {
  const ambiente = String(process.env.AMBIENTE ?? "").trim().toLowerCase();

  if (ambiente !== "teste") {
    console.error(
      `ERRO: este seed so roda com AMBIENTE="teste". AMBIENTE atual: "${ambiente || "(ausente)"}". ` +
      "Ative o .env de teste com: copy /Y .env.teste .env"
    );
    process.exit(1);
  }

  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error("ERRO: DATABASE_URL nao definida no .env ativo.");
    process.exit(1);
  }

  const hostAtivo = extrairHost(databaseUrl);

  if (!hostAtivo) {
    console.error("ERRO: DATABASE_URL do .env ativo nao e uma connection string valida.");
    process.exit(1);
  }

  const databaseUrlTeste = lerVariavelDeArquivoEnv(ARQUIVO_ENV_TESTE, "DATABASE_URL");

  if (!databaseUrlTeste) {
    console.error(
      `ERRO: nao foi possivel ler DATABASE_URL de ${ARQUIVO_ENV_TESTE}. ` +
      "Sem essa referencia o seed nao consegue provar que o alvo e o banco de teste."
    );
    process.exit(1);
  }

  const hostTeste = extrairHost(databaseUrlTeste);

  if (!hostTeste) {
    console.error(`ERRO: DATABASE_URL de ${ARQUIVO_ENV_TESTE} nao e uma connection string valida.`);
    process.exit(1);
  }

  if (hostAtivo !== hostTeste) {
    console.error(
      "ERRO: o host de DATABASE_URL do .env ativo NAO bate com o host registrado em " +
      `${ARQUIVO_ENV_TESTE}. Ativo: ${hostAtivo} | Teste: ${hostTeste}. Abortando para nao escrever ` +
      "em um banco que pode ser de producao."
    );
    process.exit(1);
  }

  return { ambiente, databaseUrl, host: hostAtivo };
}

// ==========================================
// GERADOR PSEUDOALEATORIO COM SEMENTE FIXA
// ==========================================
function criarGerador(semente) {
  let estado = semente >>> 0;

  return function proximo() {
    estado = (estado + 0x6d2b79f5) >>> 0;
    let t = estado;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const aleatorio = criarGerador(SEMENTE);

function inteiro(min, max) {
  return min + Math.floor(aleatorio() * (max - min + 1));
}

function decimal(min, max, casas = 2) {
  const fator = 10 ** casas;
  return Math.round((min + aleatorio() * (max - min)) * fator) / fator;
}

function escolher(lista) {
  return lista[Math.floor(aleatorio() * lista.length)];
}

function chance(percentual) {
  return aleatorio() * 100 < percentual;
}

function arredondar(valor, casas = 2) {
  const fator = 10 ** casas;
  return Math.round(valor * fator) / fator;
}

// ==========================================
// HELPERS DE DATA (ultimos 12 meses)
// ==========================================
// indiceMes: 0 = 11 meses atras ... 11 = mes atual
function limitesDoMes(indiceMes) {
  const offset = 11 - indiceMes;
  const inicio = new Date(AGORA.getFullYear(), AGORA.getMonth() - offset, 1, 0, 0, 0, 0);
  const fimMes = new Date(inicio.getFullYear(), inicio.getMonth() + 1, 1, 0, 0, 0, 0).getTime();
  const fim = Math.min(fimMes, AGORA.getTime());

  return { inicio: inicio.getTime(), fim };
}

function dataNoMes(indiceMes) {
  const { inicio, fim } = limitesDoMes(indiceMes);

  if (fim - inicio <= HORA_MS) {
    return new Date(fim - HORA_MS);
  }

  const bruto = new Date(inicio + aleatorio() * (fim - inicio));
  bruto.setHours(inteiro(8, 18), inteiro(0, 59), 0, 0);

  if (bruto.getTime() > fim - HORA_MS) {
    return new Date(fim - HORA_MS - Math.floor(aleatorio() * 6 * HORA_MS));
  }

  if (bruto.getTime() < inicio) {
    return new Date(inicio + HORA_MS);
  }

  return bruto;
}

function diaDoMes(indiceMes, dia) {
  const offset = 11 - indiceMes;
  return new Date(AGORA.getFullYear(), AGORA.getMonth() - offset, dia, 10, 0, 0, 0);
}

function rotuloMes(indiceMes) {
  const offset = 11 - indiceMes;
  const data = new Date(AGORA.getFullYear(), AGORA.getMonth() - offset, 1);
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`;
}

function somarDias(data, dias) {
  return new Date(data.getTime() + dias * DIA_MS);
}

function diasAtras(dias, hora = 15) {
  const data = new Date(AGORA.getTime() - dias * DIA_MS);
  data.setHours(hora, inteiro(0, 59), 0, 0);
  return data.getTime() > AGORA.getTime() ? new Date(AGORA.getTime() - HORA_MS) : data;
}

function limitarAoPresente(data) {
  return data.getTime() > AGORA.getTime() ? new Date(AGORA.getTime() - HORA_MS) : data;
}

// ==========================================
// CATALOGOS DE DADOS PLAUSIVEIS
// ==========================================
const NOMES_FISICOS = [
  "Ana Paula Ribeiro", "Bruno Cesar Almeida", "Carla Menezes Duarte", "Diego Fontenele Lima",
  "Eduarda Vasconcelos", "Felipe Nogueira Braga", "Gabriela Assuncao Reis", "Henrique Portela Cruz",
  "Isabela Marques Tavares", "Joao Vitor Serrano", "Karina Bezerra Pinto", "Leandro Quadros Matos",
  "Mariana Coutinho Lopes", "Nathan Peixoto Farias", "Olivia Sampaio Rocha", "Paulo Renato Vieira",
  "Rafaela Andrade Cardoso", "Samuel Teixeira Barros",
];

const NOMES_JURIDICOS = [
  ["Alfa Contabilidade Ltda", "Alfa Contabil"],
  ["Beta Transportes Eireli", "Beta Log"],
  ["Delta Materiais de Construcao Ltda", "Delta Construcoes"],
  ["Omega Clinica Odontologica Ltda", "Omega Odonto"],
  ["Sigma Distribuidora de Alimentos Ltda", "Sigma Alimentos"],
  ["Vertex Consultoria Empresarial Ltda", "Vertex Consult"],
  ["Zenite Escola de Idiomas Ltda", "Zenite Idiomas"],
];

const FORNECEDORES = [
  ["Mundo das Pecas Distribuidora Ltda", "Mundo das Pecas"],
  ["TelaTop Importacao e Comercio Ltda", "TelaTop"],
  ["BateriaMax Suprimentos Ltda", "BateriaMax"],
  ["Conecta Componentes Eletronicos Ltda", "Conecta Componentes"],
  ["AcessorioSul Atacado Ltda", "AcessorioSul"],
];

const CIDADES = [
  ["Fortaleza", "CE"], ["Caucaia", "CE"], ["Maracanau", "CE"],
  ["Sobral", "CE"], ["Eusebio", "CE"], ["Aquiraz", "CE"],
];

const BAIRROS = ["Centro", "Aldeota", "Messejana", "Parangaba", "Montese", "Benfica", "Meireles"];

const PRODUTOS_BASE = [
  ["Pelicula 3D Vidro Temperado", "ACESSORIO", 6.5, 29.9, 60],
  ["Capa Antichoque Transparente", "ACESSORIO", 8.9, 39.9, 45],
  ["Cabo USB-C 1m Reforcado", "ACESSORIO", 11.5, 44.9, 38],
  ["Carregador Turbo 20W", "ACESSORIO", 27.0, 89.9, 24],
  ["Fone Bluetooth TWS Basico", "ACESSORIO", 42.0, 139.9, 18],
  ["Suporte Veicular Magnetico", "ACESSORIO", 14.0, 54.9, 20],
  ["Power Bank 10000mAh", "ACESSORIO", 58.0, 169.9, 12],
  ["Tela Compativel Linha A - Android", "PECA_REPARO", 185.0, 429.9, 9],
  ["Tela Original Linha Premium", "PECA_REPARO", 420.0, 989.9, 5],
  ["Bateria Compativel Universal", "PECA_REPARO", 52.0, 149.9, 22],
  ["Conector de Carga Tipo-C", "PECA_REPARO", 28.0, 99.9, 26],
  ["Tampa Traseira Vidro iPhone", "PECA_REPARO", 95.0, 289.9, 8],
  ["Alto-falante Auricular", "PECA_REPARO", 19.0, 79.9, 30],
  ["Servico de Limpeza Interna", "SERVICO", 0, 69.9, 0],
  ["Servico de Backup e Configuracao", "SERVICO", 0, 89.9, 0],
];

const EQUIPAMENTOS = [
  ["Smartphone", "Samsung", ["Galaxy A15", "Galaxy A34", "Galaxy S21", "Galaxy M54", "Galaxy A55"]],
  ["Smartphone", "Apple", ["iPhone 11", "iPhone 12", "iPhone 13", "iPhone XR", "iPhone 14 Pro"]],
  ["Smartphone", "Motorola", ["Moto G54", "Moto G84", "Edge 40", "Moto E13"]],
  ["Smartphone", "Xiaomi", ["Redmi Note 12", "Redmi Note 13", "Poco X6", "Redmi 12C"]],
  ["Tablet", "Samsung", ["Galaxy Tab A8", "Galaxy Tab S6 Lite"]],
  ["Tablet", "Apple", ["iPad 9a geracao", "iPad Air 4"]],
];

const RELATOS = [
  "Aparelho nao liga apos queda",
  "Tela trincada e touch falhando nas bordas",
  "Nao carrega, so funciona balancando o cabo",
  "Bateria descarrega em poucas horas",
  "Caiu na agua e ficou com a imagem escura",
  "Sem audio na chamada, alto-falante mudo",
  "Reiniciando sozinho durante o uso",
  "Camera traseira embacada apos troca em outra loja",
  "Aparelho esquenta muito e trava",
  "Botao de volume preso e nao responde",
];

const CONDICOES_FISICAS = [
  "Riscos leves nas laterais",
  "Carcaca amassada no canto inferior",
  "Aparelho em bom estado geral",
  "Tela estilhacada, sem outros danos aparentes",
  "Marcas de oxidacao visiveis na entrada de carga",
];

const ACESSORIOS = ["Sem acessorios", "Capa e pelicula", "Carregador original", "Chip e cartao SD", "Capa silicone"];

const DESCRICOES_PECA = {
  TELA: ["Troca de tela completa (display + touch)", "Substituicao de display original"],
  BATERIA: ["Substituicao de bateria", "Troca de bateria com selo"],
  CONECTOR_CARGA: ["Troca do conector de carga", "Substituicao da placa de carga"],
  TAMPA_IPHONE: ["Troca da tampa traseira de vidro", "Substituicao da tampa iPhone"],
  TAMPA_ANDROID: ["Troca da tampa traseira", "Substituicao da tampa Android"],
  OUTROS: ["Limpeza e revisao completa", "Troca de alto-falante", "Reparo de trilha na placa", "Mao de obra tecnica"],
};

const TAXAS_PAGAMENTO = {
  PIX: 0,
  DINHEIRO: 0,
  CARTAO_DEBITO: 1.99,
  CARTAO_CREDITO_AVISTA: 3.19,
  CARTAO_CREDITO_PARCELADO: 4.49,
};

const FORMAS_PDV = ["PIX", "DINHEIRO", "CARTAO_DEBITO", "CARTAO_CREDITO_AVISTA", "CARTAO_CREDITO_PARCELADO"];

// Despesas fixas mensais: base de custo que nao acompanha o faturamento.
const DESPESAS_FIXAS = [
  ["Aluguel da loja", "Imobiliaria Centro Ltda", 2400, 2400],
  ["Folha de pagamento da equipe", "Folha de pagamento", 1900, 1900],
  ["Encargos e impostos sobre a folha", "FGTS e INSS", 580, 620],
  ["Energia eletrica", "Enel Distribuicao", 320, 540],
  ["Internet e telefonia", "Provedor NetFibra", 189.9, 189.9],
  ["Honorarios contabeis", "Alfa Contabilidade Ltda", 540, 540],
];

// [descricao, valorTotal, qtdParcelas, mesInicial] - cronogramas escalonados para nunca
// empilhar demais no mesmo mes e estourar o alvo de despesa operacional.
const DESPESAS_PARCELADAS = [
  ["Bancada e mobiliario tecnico", 2400, 4, 0],
  ["Notebook do balcao de atendimento", 2100, 3, 1],
  ["Ar-condicionado split da oficina", 2200, 4, 2],
  ["Estacao de solda e retrabalho BGA", 3000, 5, 4],
  ["Microscopio trinocular para microsolda", 3300, 6, 5],
  ["Comunicacao visual da fachada", 1800, 3, 9],
];

// Sorteadas para completar a despesa variavel do mes.
const DESPESAS_UNICAS_POOL = [
  ["Reposicao de estoque para revenda", "AcessorioSul Atacado Ltda"],
  ["Investimento em anuncios e trafego pago", "Agencia Pulso Digital"],
  ["Embalagens e material de loja", "Papelaria Norte"],
  ["Manutencao predial e limpeza", "Servicos Predial Ceara"],
  ["Software de gestao e backup em nuvem", "Konext Cloud"],
  ["Frete e despacho de pecas", "Beta Transportes Eireli"],
  ["Seguro do estabelecimento", "Seguradora Litoral"],
  ["Treinamento tecnico da equipe", "Instituto Reparo Pro"],
  ["Agua e taxa de condominio", "Condominio Galeria Centro"],
  ["Uniformes e EPIs da bancada", "Confeccoes Uniforte"],
];

const TEXTO_GARANTIA =
  "A garantia cobre exclusivamente a peca substituida e o servico executado nesta ordem de servico, " +
  "pelo prazo indicado neste termo. Nao estao cobertos danos por queda, contato com liquidos, " +
  "oxidacao, mau uso, violacao do lacre ou intervencao de terceiros. A garantia e valida mediante " +
  "apresentacao deste termo e do documento do responsavel pela retirada.";

const MOTIVOS_RETORNO = [
  "Tela apresentou manchas apos 20 dias de uso",
  "Aparelho voltou a desligar sozinho",
  "Conector de carga folgado novamente",
  "Bateria com autonomia abaixo do esperado",
  "Touch falhando na regiao superior",
  "Ruido no alto-falante apos o reparo",
  "Aparelho nao completa a inicializacao",
  "Marca de infiltracao sob o display",
];

// ==========================================
// PLANO FINANCEIRO MENSAL
// ==========================================
// A loja precisa parecer uma assistencia tecnica saudavel, nao uma empresa que perde dinheiro
// todo mes. A geracao e dirigida por alvo, nesta ordem:
//   1. receita do mes (sazonal), dividida entre balcao (PDV) e ordens de servico;
//   2. custo direto (peca das OS PRONTO/ENTREGUE + custo das mercadorias vendidas no PDV);
//   3. despesas operacionais, que fecham a conta para a margem liquida cair na faixa desejada.
// A receita e medida como o dashboard mede (lib/dashboard/regras-financeiras.ts):
//   Venda.valorTotal por criadoEm + ContaReceber RECEBIDO (sem vendaId) por dataRecebimento.
const RECEITA_BASE_MENSAL = 24000;
const RECEITA_MINIMA_MENSAL = 19000;
const RECEITA_MAXIMA_MENSAL = 31000;

// Indice = mes do calendario (0 = janeiro). Dezembro forte, janeiro/fevereiro fracos.
const SAZONALIDADE = [0.8, 0.83, 0.95, 0.98, 1.08, 1.02, 0.99, 1.03, 0.96, 1.06, 1.12, 1.28];

const FAIXA_FRACAO_PDV = [0.24, 0.3];
const FAIXA_MARGEM_ALVO = [0.18, 0.23];
const FAIXA_RATIO_CUSTO_PECA = [0.28, 0.34];

function mesCalendario(indiceMes) {
  const offset = 11 - indiceMes;
  return new Date(AGORA.getFullYear(), AGORA.getMonth() - offset, 1).getMonth();
}

// Converte uma data no indice de mes da janela (0 = 11 meses atras, 11 = mes atual).
function indiceMesDaData(data) {
  const diferenca = (data.getFullYear() - AGORA.getFullYear()) * 12 + (data.getMonth() - AGORA.getMonth());
  const indice = 11 + diferenca;
  return indice >= 0 && indice <= 11 ? indice : null;
}

function montarPlanoMensal() {
  const meses = [];

  for (let m = 0; m < 12; m += 1) {
    const sazonal = SAZONALIDADE[mesCalendario(m)];
    const ruido = decimal(0.97, 1.03, 4);
    const receitaAlvo = Math.min(
      RECEITA_MAXIMA_MENSAL,
      Math.max(RECEITA_MINIMA_MENSAL, arredondar(RECEITA_BASE_MENSAL * sazonal * ruido))
    );
    const receitaPdvAlvo = arredondar(receitaAlvo * decimal(FAIXA_FRACAO_PDV[0], FAIXA_FRACAO_PDV[1], 4));

    meses.push({
      indice: m,
      receitaAlvo,
      receitaPdvAlvo,
      receitaOsAlvo: arredondar(receitaAlvo - receitaPdvAlvo),
      margemAlvo: decimal(FAIXA_MARGEM_ALVO[0], FAIXA_MARGEM_ALVO[1], 4),
    });
  }

  return meses;
}

// ==========================================
// MONTAGEM DO PLANO DE DADOS
// ==========================================
function documentoFisico(indice) {
  return `900${String(indice).padStart(8, "0")}`;
}

function documentoJuridico(indice) {
  return `90${String(indice).padStart(12, "0")}`;
}

function telefone() {
  return `(85) 9${inteiro(1000, 9999)}-${inteiro(1000, 9999)}`;
}

function montarClientes() {
  const clientes = [];

  NOMES_FISICOS.forEach((nome, i) => {
    const [cidade, estado] = escolher(CIDADES);
    clientes.push({
      tipoPessoa: "FISICA",
      papel: "CLIENTE",
      nomeRazaoSocial: nome,
      nomeFantasia: null,
      documento: documentoFisico(i + 1),
      email: `${nome.split(" ")[0].toLowerCase()}${i + 1}@exemplo.com.br`,
      telefone: telefone(),
      isWhatsapp: chance(85),
      cep: `60${inteiro(100, 899)}-${inteiro(100, 999)}`,
      logradouro: `Rua ${escolher(["das Acacias", "Sao Jorge", "Dom Pedro", "Monsenhor Tabosa", "Padre Cicero"])}`,
      numero: String(inteiro(10, 1990)),
      bairro: escolher(BAIRROS),
      cidade,
      estado,
      categoria: "CLIENTE_FINAL",
      observacoes: null,
    });
  });

  NOMES_JURIDICOS.forEach(([razao, fantasia], i) => {
    const [cidade, estado] = escolher(CIDADES);
    clientes.push({
      tipoPessoa: "JURIDICA",
      papel: "CLIENTE",
      nomeRazaoSocial: razao,
      nomeFantasia: fantasia,
      documento: documentoJuridico(i + 1),
      email: `contato@${fantasia.split(" ")[0].toLowerCase()}.com.br`,
      telefone: telefone(),
      isWhatsapp: chance(60),
      cep: `60${inteiro(100, 899)}-${inteiro(100, 999)}`,
      logradouro: `Avenida ${escolher(["Santos Dumont", "Bezerra de Menezes", "Washington Soares", "Godofredo Maciel"])}`,
      numero: String(inteiro(100, 4900)),
      bairro: escolher(BAIRROS),
      cidade,
      estado,
      categoria: "EMPRESA",
      observacoes: "Cliente corporativo com atendimento prioritario.",
    });
  });

  FORNECEDORES.forEach(([razao, fantasia], i) => {
    const [cidade, estado] = escolher(CIDADES);
    clientes.push({
      tipoPessoa: "JURIDICA",
      papel: "FORNECEDOR",
      nomeRazaoSocial: razao,
      nomeFantasia: fantasia,
      documento: documentoJuridico(100 + i + 1),
      email: `comercial@${fantasia.split(" ")[0].toLowerCase()}.com.br`,
      telefone: telefone(),
      isWhatsapp: chance(70),
      cep: `60${inteiro(100, 899)}-${inteiro(100, 999)}`,
      logradouro: `Rua ${escolher(["dos Importadores", "Industrial", "Comercio Norte"])}`,
      numero: String(inteiro(100, 2900)),
      bairro: escolher(BAIRROS),
      cidade,
      estado,
      categoria: "EMPRESA",
      observacoes: "Fornecedor de pecas e acessorios.",
    });
  });

  return clientes;
}

function montarProdutos() {
  return PRODUTOS_BASE.map(([nome, categoria, custo, precoVenda, estoque], i) => ({
    codigoBarras: `789${String(1000000 + i).padStart(10, "0")}`,
    nome,
    descricao: `${nome} - item de catalogo da assistencia.`,
    categoria,
    custo,
    precoVenda,
    quantidadeEstoque: estoque,
    estoqueMinimo: categoria === "SERVICO" ? 0 : inteiro(3, 8),
    ativo: true,
  }));
}

// ==========================================
// ORDENS DE SERVICO
// ==========================================
// Somente as OS ainda em andamento entram por quantidade fixa. As ENTREGUE sao geradas por
// alvo de receita mensal, porque sao elas que alimentam o faturamento do painel.
const PLANO_OS_ABERTAS = [
  { status: "PRONTO", quantidade: 12, perfil: "pronto" },
  { status: "EM_MANUTENCAO", quantidade: 12, perfil: "aberto" },
  { status: "AGUARDANDO_PECA", quantidade: 10, perfil: "aberto" },
  { status: "AGUARDANDO_ORCAMENTO", quantidade: 8, perfil: "aberto" },
  { status: "AGUARDANDO_APROVACAO", quantidade: 8, perfil: "aberto" },
  { status: "APROVADO", quantidade: 6, perfil: "aberto" },
  { status: "GARANTIA_RETORNO", quantidade: 4, perfil: "aberto" },
];

function montarDatasOSAberta(perfil, indiceGlobal, indiceNoGrupo) {
  if (perfil === "pronto") {
    // Um terco fica parado em PRONTO ha mais de 2 dias (alimenta o alerta de retirada).
    const paradoHaDias = indiceNoGrupo % 3 === 0 ? inteiro(3, 14) : inteiro(0, 2);
    const atualizadoEm = diasAtras(paradoHaDias);
    return { criadoEm: somarDias(atualizadoEm, -inteiro(2, 9)), atualizadoEm };
  }

  // perfil "aberto": metade recente, metade parada ha 10-40 dias sem atualizacao.
  const parada = indiceGlobal % 2 === 0;
  const paradoHaDias = parada ? inteiro(10, 40) : inteiro(0, 8);
  const atualizadoEm = diasAtras(paradoHaDias);
  const criadoEm = parada ? new Date(atualizadoEm.getTime()) : somarDias(atualizadoEm, -inteiro(0, 5));
  return { criadoEm, atualizadoEm };
}

function novaOrdem(chave, clienteId, status, criadoEm, atualizadoEm) {
  const [equipamento, marca, modelos] = escolher(EQUIPAMENTOS);

  return {
    chave,
    clienteId,
    equipamento,
    marca,
    modelo: escolher(modelos),
    imei: String(inteiro(100000000000000, 999999999999999)),
    senha: chance(45) ? String(inteiro(1000, 9999)) : null,
    senhaDesenho: null,
    relatoCliente: escolher(RELATOS),
    condicaoFisica: escolher(CONDICOES_FISICAS),
    acessorios: escolher(ACESSORIOS),
    status,
    ehRetornoGarantia: status === "GARANTIA_RETORNO",
    observacoes: chance(30) ? "Cliente autorizou contato por WhatsApp." : null,
    prazoGarantiaDias: 90,
    criadoEm,
    atualizadoEm,
    valorConta: 0,
  };
}

// O tipo da peca acompanha a faixa de preco: reparo caro tende a ser tela, barato tende a
// ser conector ou mao de obra.
function tipoPecaPorValor(valorCobrado) {
  if (valorCobrado >= 700) return escolher(["TELA", "TELA", "TAMPA_IPHONE"]);
  if (valorCobrado >= 380) return escolher(["TELA", "TAMPA_IPHONE", "TAMPA_ANDROID"]);
  if (valorCobrado >= 190) return escolher(["BATERIA", "TAMPA_ANDROID", "CONECTOR_CARGA"]);
  return escolher(["CONECTOR_CARGA", "BATERIA", "OUTROS", "OUTROS"]);
}

function novoItemOs(osChave, criadoEm, valorCobrado) {
  const valor = arredondar(valorCobrado);
  const tipoPeca = tipoPecaPorValor(valor);
  const ratio = decimal(FAIXA_RATIO_CUSTO_PECA[0], FAIXA_RATIO_CUSTO_PECA[1], 4);

  return {
    osChave,
    descricao: escolher(DESCRICOES_PECA[tipoPeca]),
    tipoPeca,
    custoPeca: arredondar(valor * ratio),
    valorCobrado: valor,
    criadoEm,
  };
}

function dividirTicket(total, partes) {
  if (partes <= 1) return [arredondar(total)];
  const primeira = arredondar(total * decimal(0.45, 0.7, 4));
  return [primeira, arredondar(total - primeira)];
}

function montarOrdensAbertas(clientesIds) {
  const ordens = [];
  const itens = [];
  // Somente PRONTO e ENTREGUE entram no custo de peca do painel.
  const custoProntoPorMes = new Array(12).fill(0);
  let indiceGlobal = 0;

  for (const grupo of PLANO_OS_ABERTAS) {
    for (let i = 0; i < grupo.quantidade; i += 1) {
      const { criadoEm, atualizadoEm } = montarDatasOSAberta(grupo.perfil, indiceGlobal, i);
      const chave = `os-aberta-${indiceGlobal}`;
      const clienteId = clientesIds[indiceGlobal % clientesIds.length];

      ordens.push(novaOrdem(chave, clienteId, grupo.status, criadoEm, atualizadoEm));

      const semItem = grupo.status === "AGUARDANDO_ORCAMENTO" ? chance(70) : chance(8);

      if (!semItem) {
        const ticket = decimal(160, 620);
        const partes = chance(25) ? 2 : 1;

        for (const valor of dividirTicket(ticket, partes)) {
          const item = novoItemOs(chave, somarDias(criadoEm, chance(50) ? 0 : 1), valor);
          itens.push(item);

          if (grupo.status === "PRONTO") {
            const mes = indiceMesDaData(atualizadoEm);
            if (mes !== null) {
              custoProntoPorMes[mes] = arredondar(custoProntoPorMes[mes] + item.custoPeca);
            }
          }
        }
      }

      indiceGlobal += 1;
    }
  }

  return { ordens, itens, custoProntoPorMes };
}

function montarOrdensEntregues(clientesIds, planoMensal) {
  const ordens = [];
  const itens = [];
  const receitaPorMes = new Array(12).fill(0);
  const custoPorMes = new Array(12).fill(0);
  let indiceGlobal = 0;

  for (const mes of planoMensal) {
    let restante = mes.receitaOsAlvo;

    while (restante >= 120) {
      // A data de ENTREGA (atualizadoEm) e o que joga receita e custo no mes; ela fica
      // dentro do mes e a abertura recua de 1 a 10 dias, podendo cair no mes anterior.
      const entregaEm = dataNoMes(mes.indice);
      const criadoEm = somarDias(entregaEm, -inteiro(1, 10));
      const ticketBruto = chance(70) ? decimal(160, 620) : decimal(620, 1350);
      const ticket = arredondar(Math.min(restante, ticketBruto));
      const chave = `os-entregue-${indiceGlobal}`;
      const ordem = novaOrdem(
        chave,
        clientesIds[(indiceGlobal * 7) % clientesIds.length],
        "ENTREGUE",
        criadoEm,
        entregaEm
      );

      let receitaOrdem = 0;
      let custoOrdem = 0;

      for (const valor of dividirTicket(ticket, chance(35) ? 2 : 1)) {
        const item = novoItemOs(chave, criadoEm, valor);
        itens.push(item);
        receitaOrdem = arredondar(receitaOrdem + item.valorCobrado);
        custoOrdem = arredondar(custoOrdem + item.custoPeca);
      }

      ordem.valorConta = receitaOrdem;
      ordens.push(ordem);

      receitaPorMes[mes.indice] = arredondar(receitaPorMes[mes.indice] + receitaOrdem);
      custoPorMes[mes.indice] = arredondar(custoPorMes[mes.indice] + custoOrdem);
      restante = arredondar(restante - receitaOrdem);
      indiceGlobal += 1;
    }
  }

  return { ordens, itens, receitaPorMes, custoPorMes };
}

// ==========================================
// PDV (caixa, vendas, itens e pagamentos)
// ==========================================
function montarCaixaSessions() {
  const sessoes = [];

  for (let mes = 0; mes < 12; mes += 1) {
    const { inicio, fim } = limitesDoMes(mes);
    const dataAbertura = new Date(inicio + 8 * HORA_MS);
    const ehMesAtual = mes === 11;
    const dataFechamento = ehMesAtual ? null : new Date(fim - HORA_MS);

    sessoes.push({
      chave: `caixa-${mes}`,
      mes,
      status: ehMesAtual ? "ABERTO" : "FECHADO",
      valorAbertura: decimal(150, 400),
      valorFechamento: ehMesAtual ? null : decimal(1500, 9000),
      dataAbertura,
      dataFechamento,
      criadoEm: dataAbertura,
      atualizadoEm: dataFechamento ?? dataAbertura,
    });
  }

  return sessoes;
}

function sortearProdutoAte(produtos, tetoPreco) {
  const elegiveis = produtos.filter((p) => p.precoVenda <= tetoPreco);
  return escolher(elegiveis.length > 0 ? elegiveis : produtos);
}

function montarVendas(clientesIds, produtos, planoMensal) {
  const vendas = [];
  const itens = [];
  const pagamentos = [];
  const receitaPorMes = new Array(12).fill(0);
  const custoPorMes = new Array(12).fill(0);
  let indiceVenda = 0;

  for (const mes of planoMensal) {
    let restante = mes.receitaPdvAlvo;

    while (restante >= 40) {
      const chaveVenda = `venda-${indiceVenda}`;
      const criadoEm = dataNoMes(mes.indice);
      const ticketAlvo = arredondar(Math.min(restante, decimal(80, 760)));
      const itensVenda = [];
      let subtotalBruto = 0;

      while (subtotalBruto < ticketAlvo * 0.92 && itensVenda.length < 4) {
        const produto = sortearProdutoAte(produtos, ticketAlvo - subtotalBruto + 80);
        const quantidade = produto.precoVenda * 2 <= ticketAlvo - subtotalBruto ? inteiro(1, 2) : 1;
        const subtotal = arredondar(produto.precoVenda * quantidade);

        itensVenda.push({ produto, quantidade, subtotal });
        subtotalBruto = arredondar(subtotalBruto + subtotal);
      }

      // O desconto absorve a diferenca entre o carrinho e o ticket alvo, ate 30% do bruto.
      const descontoMaximo = arredondar(subtotalBruto * 0.3);
      const desconto = arredondar(Math.min(Math.max(0, subtotalBruto - ticketAlvo), descontoMaximo));
      const valorTotal = arredondar(subtotalBruto - desconto);
      let custoVenda = 0;

      for (const item of itensVenda) {
        custoVenda = arredondar(custoVenda + item.produto.custo * item.quantidade);
        itens.push({
          vendaChave: chaveVenda,
          produtoChave: item.produto.chave,
          descricao: item.produto.nome,
          quantidade: item.quantidade,
          custoUnitario: item.produto.custo,
          precoUnitario: item.produto.precoVenda,
          subtotal: item.subtotal,
        });
      }

      const formaPagamento = escolher(FORMAS_PDV);
      const clienteId = chance(65) ? clientesIds[(indiceVenda * 3) % clientesIds.length] : null;

      vendas.push({
        chave: chaveVenda,
        mes: mes.indice,
        clienteId,
        formaPagamento,
        valorTotal,
        desconto,
        criadoEm,
        caixaChave: `caixa-${mes.indice}`,
      });

      const percentualTaxa = TAXAS_PAGAMENTO[formaPagamento] ?? 0;
      const valorTaxa = arredondar((valorTotal * percentualTaxa) / 100);
      const parcelasCartao = formaPagamento === "CARTAO_CREDITO_PARCELADO" ? inteiro(2, 6) : 1;

      pagamentos.push({
        chave: `pag-${indiceVenda}`,
        vendaChave: chaveVenda,
        formaPagamento,
        valorBruto: valorTotal,
        percentualTaxa,
        valorTaxa,
        valorLiquido: arredondar(valorTotal - valorTaxa),
        parcelas: parcelasCartao,
        diasVencimento: parcelasCartao > 1 ? 30 : null,
        dataVencimento: parcelasCartao > 1 ? somarDias(criadoEm, 30) : criadoEm,
        criadoEm,
        atualizadoEm: criadoEm,
      });

      receitaPorMes[mes.indice] = arredondar(receitaPorMes[mes.indice] + valorTotal);
      custoPorMes[mes.indice] = arredondar(custoPorMes[mes.indice] + custoVenda);
      restante = arredondar(restante - valorTotal);
      indiceVenda += 1;
    }
  }

  return { vendas, itens, pagamentos, receitaPorMes, custoPorMes };
}

// ==========================================
// GARANTIAS
// ==========================================
function montarTermosGarantia(ordensEntregues) {
  return ordensEntregues.map((os) => {
    const prazoGarantiaDias = escolher([90, 90, 90, 180, 30]);
    const dataInicioGarantia = new Date(os.atualizadoEm.getTime());

    return {
      chave: `termo-${os.chave}`,
      osChave: os.chave,
      prazoGarantiaDias,
      dataInicioGarantia,
      dataFimGarantia: somarDias(dataInicioGarantia, prazoGarantiaDias),
      textoGarantia: TEXTO_GARANTIA,
      criadoEm: dataInicioGarantia,
      atualizadoEm: dataInicioGarantia,
    };
  });
}

function montarRetornosGarantia(termos, ordensPorChave) {
  const retornos = [];
  // Pega termos espalhados na lista para nao concentrar tudo no mesmo periodo.
  const passo = Math.max(1, Math.floor(termos.length / 8));

  for (let i = 0; i < 8; i += 1) {
    const termo = termos[(i * passo) % termos.length];
    if (!termo) continue;

    const os = ordensPorChave.get(termo.osChave);
    const abertoEm = limitarAoPresente(somarDias(termo.dataInicioGarantia, inteiro(5, 60)));
    const finalizado = i < 5;
    const resultado = finalizado
      ? escolher(["PROCEDENTE", "RESOLVIDO_SEM_TROCA", "TROCA_REALIZADA", "IMPROCEDENTE", "COBRANCA_ADICIONAL"])
      : "EM_ANALISE";
    const houveCobranca = resultado === "COBRANCA_ADICIONAL";
    const finalizadoEm = finalizado ? limitarAoPresente(somarDias(abertoEm, inteiro(1, 8))) : null;

    retornos.push({
      chave: `retorno-${i}`,
      termoChave: termo.chave,
      osOrigemChave: os ? os.chave : null,
      motivo: MOTIVOS_RETORNO[i % MOTIVOS_RETORNO.length],
      descricao: "Cliente retornou a loja relatando o mesmo sintoma dentro do prazo de garantia.",
      analiseTecnica: finalizado
        ? "Bancada refez os testes de continuidade e validou o comportamento relatado."
        : null,
      resultado,
      descricaoServico: finalizado ? "Reabertura do aparelho, reteste e ajuste do modulo substituido." : null,
      pecasAdicionais: resultado === "TROCA_REALIZADA" ? "Peca substituida novamente sem custo" : null,
      houveTroca: resultado === "TROCA_REALIZADA",
      houveCobranca,
      valorAdicional: houveCobranca ? decimal(80, 260) : null,
      finalizadoEm,
      criadoEm: abertoEm,
      atualizadoEm: finalizadoEm ?? abertoEm,
    });
  }

  return retornos;
}

// ==========================================
// CONTAS A RECEBER
// ==========================================
// Regra do painel: conta ligada a venda e descartada (a Venda ja conta). Entao a receita de
// servico vem exclusivamente das contas de OS entregues, com status RECEBIDO.
function montarContasReceber(ordensEntregues, vendas, pagamentosPorVenda, clientesIds) {
  const contas = [];

  for (const os of ordensEntregues) {
    const forma = escolher(["PIX", "DINHEIRO", "CARTAO_DEBITO", "CARTAO_CREDITO_AVISTA", "CARTAO_CREDITO_PARCELADO"]);

    contas.push({
      descricao: `Servico OS - ${os.equipamento} ${os.marca}`,
      valor: os.valorConta,
      osChave: os.chave,
      clienteId: os.clienteId,
      dataVencimento: os.atualizadoEm,
      dataRecebimento: os.atualizadoEm,
      status: "RECEBIDO",
      formaPagamento: forma,
      formaRecebimento: forma,
      origem: "ORDEM_SERVICO",
      criadoEm: os.atualizadoEm,
      atualizadoEm: os.atualizadoEm,
    });
  }

  for (const venda of vendas) {
    const pagamento = pagamentosPorVenda.get(venda.chave);
    if (!pagamento) continue;

    contas.push({
      descricao: "Venda PDV",
      valor: pagamento.valorBruto,
      vendaChave: venda.chave,
      pagamentoChave: pagamento.chave,
      clienteId: venda.clienteId,
      dataVencimento: pagamento.dataVencimento ?? venda.criadoEm,
      dataRecebimento: venda.criadoEm,
      status: "RECEBIDO",
      formaPagamento: pagamento.formaPagamento,
      formaRecebimento: pagamento.formaPagamento,
      origem: "VENDA_PDV",
      criadoEm: venda.criadoEm,
      atualizadoEm: venda.criadoEm,
    });
  }

  // Pendencias e atrasos: nao entram na receita (nao estao RECEBIDO), mas alimentam a
  // faixa de alertas e a lista de cobranca do painel.
  for (let i = 0; i < 10; i += 1) {
    const atrasada = i % 2 === 0;
    const criadoEm = dataNoMes(9 + (i % 3));

    contas.push({
      descricao: atrasada ? "Contrato de manutencao corporativa" : "Servico avulso faturado",
      valor: decimal(180, 1400),
      clienteId: clientesIds[(i * 5) % clientesIds.length],
      dataVencimento: atrasada ? diasAtras(inteiro(3, 55)) : somarDias(AGORA, inteiro(4, 40)),
      dataRecebimento: null,
      status: atrasada ? "ATRASADO" : "PENDENTE",
      formaPagamento: null,
      formaRecebimento: atrasada ? "BOLETO" : "PIX",
      origem: atrasada ? "CONTRATO_RECORRENTE" : "AVULSO",
      criadoEm,
      atualizadoEm: criadoEm,
    });
  }

  return contas;
}

// ==========================================
// DESPESAS (contas a pagar)
// ==========================================
// O painel soma ParcelaDespesa por dataPagamento quando PAGO e por dataVencimento caso
// contrario. Para o mes nao vazar, o pagamento fica sempre dentro do mes do vencimento.
function dataPagamentoNoMes(dataVencimento) {
  const fimDoMes = new Date(
    dataVencimento.getFullYear(),
    dataVencimento.getMonth() + 1,
    0,
    20,
    0,
    0,
    0
  ).getTime();
  const candidata = somarDias(dataVencimento, inteiro(0, 3)).getTime();

  return new Date(Math.min(candidata, fimDoMes, AGORA.getTime()));
}

// A janela do painel termina em "agora". Um vencimento que cai depois de hoje mas ainda
// dentro do mes corrente ficaria de fora da conta e inflaria a margem do mes atual, entao
// ele e puxado para hoje. Vencimentos de meses futuros continuam no futuro (a vencer).
function ajustarVencimentoNaJanela(dataVencimento) {
  if (indiceMesDaData(dataVencimento) === 11 && dataVencimento.getTime() > AGORA.getTime()) {
    return new Date(AGORA.getTime() - 2 * HORA_MS);
  }

  return dataVencimento;
}

function montarDespesas(fornecedoresIds, alvoParcelasPorMes) {
  const despesas = [];
  const parcelas = [];
  const totalPorMes = new Array(12).fill(0);
  let sequenciaVencidas = 0;
  let sequenciaAtrasadas = 0;

  function registrarParcela(despesaChave, numeroParcela, valor, vencimentoBruto, opcoes = {}) {
    const dataVencimento = ajustarVencimentoNaJanela(vencimentoBruto);
    const vencida = dataVencimento.getTime() < AGORA.getTime();
    let status = "PENDENTE";
    let dataPagamento = null;
    let valorPago = null;

    if (vencida && opcoes.atrasada) {
      status = "ATRASADO";
    } else if (vencida && !opcoes.vencidaEmAberto) {
      status = "PAGO";
      dataPagamento = dataPagamentoNoMes(dataVencimento);
      valorPago = valor;
    }

    parcelas.push({
      despesaChave,
      numeroParcela,
      valor,
      dataVencimento,
      dataPagamento,
      status,
      valorPago,
      criadoEm: vencida ? somarDias(dataVencimento, -20) : new Date(AGORA.getTime() - DIA_MS),
    });

    const mes = indiceMesDaData(dataPagamento ?? dataVencimento);
    if (mes !== null) {
      totalPorMes[mes] = arredondar(totalPorMes[mes] + valor);
    }
  }

  // --- FIXA_MENSAL: uma competencia por mes ---
  DESPESAS_FIXAS.forEach(([descricao, fornecedor, valorMin, valorMax], indice) => {
    const chave = `despesa-fixa-${indice}`;
    const valores = [];

    for (let mes = 0; mes < 12; mes += 1) {
      valores.push(decimal(valorMin, valorMax));
    }

    const criadoEm = diaDoMes(0, 2);

    despesas.push({
      chave,
      fornecedor,
      descricao,
      valorTotal: arredondar(valores.reduce((soma, valor) => soma + valor, 0)),
      tipo: "FIXA_MENSAL",
      qtdParcelas: 12,
      clienteId: indice % 2 === 0 ? fornecedoresIds[indice % fornecedoresIds.length] : null,
      criadoEm,
      atualizadoEm: criadoEm,
    });

    for (let mes = 0; mes < 12; mes += 1) {
      // Duas competencias ficam vencidas e em aberto, para alimentar a faixa de alertas.
      const vencidaEmAberto = (indice === 1 && mes === 10) || (indice === 3 && mes === 9);
      if (vencidaEmAberto) sequenciaVencidas += 1;
      registrarParcela(chave, mes + 1, valores[mes], diaDoMes(mes, 10), { vencidaEmAberto });
    }
  });

  // --- PARCELADA: cronogramas escalonados para nao concentrar no mesmo mes ---
  DESPESAS_PARCELADAS.forEach(([descricao, valorTotal, qtdParcelas, mesInicial], indice) => {
    const chave = `despesa-parcelada-${indice}`;
    const criadoEm = diaDoMes(mesInicial, 3);
    const valorParcela = arredondar(valorTotal / qtdParcelas);

    despesas.push({
      chave,
      fornecedor: FORNECEDORES[indice % FORNECEDORES.length][0],
      descricao,
      valorTotal,
      tipo: "PARCELADA",
      qtdParcelas,
      clienteId: fornecedoresIds[(indice + 1) % fornecedoresIds.length],
      criadoEm,
      atualizadoEm: criadoEm,
    });

    for (let p = 0; p < qtdParcelas; p += 1) {
      // Duas parcelas viram ATRASADO explicito (o enum tambem e usado no painel).
      const atrasada = (indice === 2 || indice === 4) && p === 1;
      if (atrasada) sequenciaAtrasadas += 1;
      registrarParcela(chave, p + 1, valorParcela, diaDoMes(mesInicial + p, 15), { atrasada });
    }
  });

  // --- UNICA: fecha exatamente o alvo de despesa operacional de cada mes ---
  let indiceUnica = 0;

  for (let mes = 0; mes < 12; mes += 1) {
    const residuo = arredondar(alvoParcelasPorMes[mes] - totalPorMes[mes]);

    if (residuo < 60) continue;

    const fatias = [
      ["Impostos sobre faturamento (Simples Nacional)", "Receita Federal", 0.38],
      ["Comissoes e bonificacao da equipe", "Folha - comissoes", 0.22],
      ["Taxas de maquininha e antecipacao de recebiveis", "Adquirente de cartoes", 0.1],
    ];
    const [descricaoExtraA, fornecedorExtraA] = escolher(DESPESAS_UNICAS_POOL);
    let descricaoExtraB = descricaoExtraA;
    let fornecedorExtraB = fornecedorExtraA;

    while (descricaoExtraB === descricaoExtraA) {
      [descricaoExtraB, fornecedorExtraB] = escolher(DESPESAS_UNICAS_POOL);
    }

    fatias.push([descricaoExtraA, fornecedorExtraA, 0.18]);
    fatias.push([descricaoExtraB, fornecedorExtraB, 0.12]);

    let distribuido = 0;

    fatias.forEach(([descricao, fornecedor, fracao], posicao) => {
      const ultima = posicao === fatias.length - 1;
      const valor = ultima ? arredondar(residuo - distribuido) : arredondar(residuo * fracao);
      if (valor < 1) return;

      distribuido = arredondar(distribuido + valor);

      const chave = `despesa-unica-${indiceUnica}`;
      const vencimento = dataNoMes(mes);
      indiceUnica += 1;

      despesas.push({
        chave,
        fornecedor,
        descricao,
        valorTotal: valor,
        tipo: "UNICA",
        qtdParcelas: 1,
        clienteId: posicao >= 3 ? fornecedoresIds[indiceUnica % fornecedoresIds.length] : null,
        criadoEm: vencimento,
        atualizadoEm: vencimento,
      });

      // Duas despesas unicas de meses recentes ficam vencidas e em aberto.
      const vencidaEmAberto = (mes === 8 || mes === 10) && posicao === 3;
      if (vencidaEmAberto) sequenciaVencidas += 1;
      registrarParcela(chave, 1, valor, vencimento, { vencidaEmAberto });
    });
  }

  return { despesas, parcelas, totalPorMes, vencidasEmAberto: sequenciaVencidas, atrasadas: sequenciaAtrasadas };
}

// ==========================================
// PERSISTENCIA
// ==========================================
function criarPrismaOperacional(connectionString) {
  return new PrismaOperacional({
    adapter: new PrismaNeon({ connectionString }),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

async function criarEmLotes(delegate, registros, tamanho = 150) {
  let total = 0;

  for (let i = 0; i < registros.length; i += tamanho) {
    const lote = registros.slice(i, i + tamanho);
    const resultado = await delegate.createMany({ data: lote });
    total += resultado.count;
  }

  return total;
}

// Unico filtro usado para contar e para apagar: nada sem o marcador entra nessas consultas.
const FILTRO_DEMO = { id: { startsWith: PREFIXO_DEMO } };

const TABELAS_DEMO = [
  "cliente",
  "produto",
  "ordemServico",
  "itemOS",
  "termoGarantiaOS",
  "retornoGarantiaOS",
  "caixaSession",
  "venda",
  "itemVenda",
  "vendaPagamento",
  "contaReceber",
  "despesa",
  "parcelaDespesa",
];

// Tabelas destacadas na mensagem de recusa, conforme pedido.
const TABELAS_PRINCIPAIS = ["cliente", "ordemServico", "venda", "contaReceber", "despesa"];

async function contarLinhasDemo(prisma) {
  const contagens = {};
  let total = 0;

  for (const tabela of TABELAS_DEMO) {
    const quantidade = await prisma[tabela].count({ where: FILTRO_DEMO });
    contagens[tabela] = quantidade;
    total += quantidade;
  }

  return { contagens, total };
}

// Ordem ditada pelas chaves estrangeiras do schema:
// - OrdemServico.retornoGarantiaId aponta para RetornoGarantiaOS e RetornoGarantiaOS.osOrigemId
//   aponta de volta para OrdemServico (ciclo): o vinculo e solto antes de qualquer delete.
// - ContaReceber referencia VendaPagamento, Venda e OrdemServico, entao sai antes das tres.
// - ItemVenda referencia Produto, e quase tudo referencia Cliente: Produto e Cliente saem por ultimo.
async function apagarLinhasDemo(prisma) {
  const etapas = [
    ["ordemServico.soltarVinculoRetorno", prisma.ordemServico.updateMany({ where: FILTRO_DEMO, data: { retornoGarantiaId: null } })],
    ["contaReceber", prisma.contaReceber.deleteMany({ where: FILTRO_DEMO })],
    ["vendaPagamento", prisma.vendaPagamento.deleteMany({ where: FILTRO_DEMO })],
    ["itemVenda", prisma.itemVenda.deleteMany({ where: FILTRO_DEMO })],
    ["venda", prisma.venda.deleteMany({ where: FILTRO_DEMO })],
    ["caixaSession", prisma.caixaSession.deleteMany({ where: FILTRO_DEMO })],
    ["retornoGarantiaOS", prisma.retornoGarantiaOS.deleteMany({ where: FILTRO_DEMO })],
    ["itemOS", prisma.itemOS.deleteMany({ where: FILTRO_DEMO })],
    ["termoGarantiaOS", prisma.termoGarantiaOS.deleteMany({ where: FILTRO_DEMO })],
    ["ordemServico", prisma.ordemServico.deleteMany({ where: FILTRO_DEMO })],
    ["parcelaDespesa", prisma.parcelaDespesa.deleteMany({ where: FILTRO_DEMO })],
    ["despesa", prisma.despesa.deleteMany({ where: FILTRO_DEMO })],
    ["produto", prisma.produto.deleteMany({ where: FILTRO_DEMO })],
    ["cliente", prisma.cliente.deleteMany({ where: FILTRO_DEMO })],
  ];

  const resultados = await prisma.$transaction(etapas.map(([, operacao]) => operacao));

  const apagadas = {};
  let total = 0;

  resultados.forEach((resultado, indice) => {
    const [rotulo] = etapas[indice];
    apagadas[rotulo] = resultado.count;
    if (rotulo !== "ordemServico.soltarVinculoRetorno") {
      total += resultado.count;
    }
  });

  return { apagadas, total };
}

async function executar() {
  const confirmar = process.argv.includes("--confirm");
  const resetar = process.argv.includes("--reset");
  // As guardas de ambiente valem para todos os modos, inclusive --reset.
  const { ambiente, databaseUrl, host } = validarAmbienteDeTeste();

  const modo = resetar
    ? (confirmar ? "RESET + CONFIRM (apaga o que tem o marcador e recria)" : "RESET DRY-RUN (nao apaga nem escreve)")
    : (confirmar ? "CONFIRM (escreve no banco)" : "DRY-RUN (nao escreve nada)");

  console.log("=== SEED DEMO DO TENANT ATIVO ===");
  console.log(`AMBIENTE      : ${ambiente.toUpperCase()}`);
  console.log(`ALVO          : ${mascarar(databaseUrl)}`);
  console.log(`HOST VALIDADO : ${host} (confere com ${ARQUIVO_ENV_TESTE})`);
  console.log(`MODO          : ${modo}`);
  console.log(`SEMENTE       : ${SEMENTE}`);
  console.log(`MARCADOR      : id LIKE "${PREFIXO_DEMO}%"`);
  console.log("");

  const prisma = criarPrismaOperacional(databaseUrl);

  try {
    // --- Guarda de reexecucao: nada e escrito enquanto houver linha marcada no banco ---
    const { contagens: contagensDemo, total: totalDemo } = await contarLinhasDemo(prisma);

    if (totalDemo > 0 && !resetar) {
      const principais = TABELAS_PRINCIPAIS.map((t) => `${t}=${contagensDemo[t]}`).join(", ");

      console.error(
        `ERRO: o banco alvo ja tem ${totalDemo} linha(s) criadas por este seed (marcador "${PREFIXO_DEMO}"). ` +
        "Rodar de novo duplicaria os numeros do dashboard."
      );
      console.error(`Tabelas principais: ${principais}`);
      console.error("Contagem completa por tabela:");
      console.error(JSON.stringify(contagensDemo, null, 2));
      console.error(
        "Para recriar do zero, use: node scripts/seed-demo-tenant.mjs --reset --confirm " +
        "(apaga somente as linhas com o marcador e semeia de novo)."
      );
      throw new Error("Seed abortado: o banco alvo ja contem dados deste seed.");
    }

    if (resetar) {
      if (!confirmar) {
        console.log("RESET DRY-RUN: seriam apagadas as linhas marcadas abaixo (nada foi apagado):");
        console.log(JSON.stringify({ total: totalDemo, porTabela: contagensDemo }, null, 2));
        console.log("");
      } else {
        const { apagadas, total: totalApagado } = await apagarLinhasDemo(prisma);
        console.log(`RESET: ${totalApagado} linha(s) com o marcador apagadas em uma unica transacao.`);
        console.log(JSON.stringify(apagadas, null, 2));
        console.log("");
      }
    }

    // --- Clientes e fornecedores (reaproveita os que ja existem pelo documento) ---
    const clientesPlano = montarClientes();
    const documentos = clientesPlano.map((c) => c.documento);
    const clientesExistentes = await prisma.cliente.findMany({
      where: { documento: { in: documentos } },
      select: { id: true, documento: true, papel: true },
    });
    const mapaClientes = new Map(clientesExistentes.map((c) => [c.documento, c.id]));
    const clientesNovos = clientesPlano.filter((c) => !mapaClientes.has(c.documento));

    // --- Produtos (reaproveita pelos codigos de barras) ---
    const produtosPlano = montarProdutos();
    const codigos = produtosPlano.map((p) => p.codigoBarras);
    const produtosExistentes = await prisma.produto.findMany({
      where: { codigoBarras: { in: codigos } },
      select: { id: true, codigoBarras: true },
    });
    const mapaProdutos = new Map(produtosExistentes.map((p) => [p.codigoBarras, p.id]));
    const produtosNovos = produtosPlano.filter((p) => !mapaProdutos.has(p.codigoBarras));

    // --- Escrita de clientes e produtos (necessaria para obter os IDs reais) ---
    // Clientes/produtos reaproveitados (ja existentes por documento/codigoBarras) ficam SEM o
    // marcador de proposito: o --reset nunca pode apagar linha que este seed nao criou.
    if (confirmar) {
      if (clientesNovos.length > 0) {
        await criarEmLotes(prisma.cliente, clientesNovos.map((c) => ({ id: idDemo(), ...c })));
      }
      if (produtosNovos.length > 0) {
        await criarEmLotes(prisma.produto, produtosNovos.map((p) => ({ id: idDemo(), ...p })));
      }

      const clientesFinais = await prisma.cliente.findMany({
        where: { documento: { in: documentos } },
        select: { id: true, documento: true },
      });
      clientesFinais.forEach((c) => mapaClientes.set(c.documento, c.id));

      const produtosFinais = await prisma.produto.findMany({
        where: { codigoBarras: { in: codigos } },
        select: { id: true, codigoBarras: true },
      });
      produtosFinais.forEach((p) => mapaProdutos.set(p.codigoBarras, p.id));
    }

    const clientesIds = clientesPlano
      .filter((c) => c.papel === "CLIENTE")
      .map((c) => mapaClientes.get(c.documento) ?? `pendente-${c.documento}`);
    const fornecedoresIds = clientesPlano
      .filter((c) => c.papel === "FORNECEDOR")
      .map((c) => mapaClientes.get(c.documento) ?? null);

    const produtosComChave = produtosPlano.map((p) => ({ ...p, chave: p.codigoBarras }));

    // --- Plano completo em memoria, dirigido pelo alvo financeiro de cada mes ---
    const planoMensal = montarPlanoMensal();

    const ordensAbertas = montarOrdensAbertas(clientesIds);
    const entregues = montarOrdensEntregues(clientesIds, planoMensal);
    const ordens = [...ordensAbertas.ordens, ...entregues.ordens];
    const itensOs = [...ordensAbertas.itens, ...entregues.itens];
    const ordensPorChave = new Map(ordens.map((os) => [os.chave, os]));

    const termos = montarTermosGarantia(entregues.ordens);
    const retornos = montarRetornosGarantia(termos, ordensPorChave);
    const sessoes = montarCaixaSessions();
    const pdv = montarVendas(clientesIds, produtosComChave, planoMensal);
    const { vendas, itens: itensVenda, pagamentos } = pdv;
    const pagamentosPorVenda = new Map(pagamentos.map((p) => [p.vendaChave, p]));
    const contasReceber = montarContasReceber(entregues.ordens, vendas, pagamentosPorVenda, clientesIds);

    // Receita e custo direto ja estao fechados; a despesa operacional e o que sobra para a
    // margem liquida do mes cair na faixa planejada.
    const receitaPorMes = [];
    const custoDiretoPorMes = [];
    const alvoParcelasPorMes = [];

    for (let m = 0; m < 12; m += 1) {
      const receita = arredondar(pdv.receitaPorMes[m] + entregues.receitaPorMes[m]);
      const custoDireto = arredondar(
        pdv.custoPorMes[m] + entregues.custoPorMes[m] + ordensAbertas.custoProntoPorMes[m]
      );

      receitaPorMes.push(receita);
      custoDiretoPorMes.push(custoDireto);
      alvoParcelasPorMes.push(arredondar(receita * (1 - planoMensal[m].margemAlvo) - custoDireto));
    }

    const { despesas, parcelas, totalPorMes: despesaOperacionalPorMes } = montarDespesas(
      fornecedoresIds,
      alvoParcelasPorMes
    );

    const projecaoMensal = [];
    let saldoAcumulado = 0;

    for (let m = 0; m < 12; m += 1) {
      const receita = receitaPorMes[m];
      const despesaTotal = arredondar(custoDiretoPorMes[m] + despesaOperacionalPorMes[m]);
      const lucro = arredondar(receita - despesaTotal);
      saldoAcumulado = arredondar(saldoAcumulado + lucro);

      projecaoMensal.push({
        mes: rotuloMes(m),
        receita,
        custoDireto: custoDiretoPorMes[m],
        despesaOperacional: despesaOperacionalPorMes[m],
        despesaTotal,
        lucro,
        margemPercentual: receita > 0 ? arredondar((lucro / receita) * 100, 1) : 0,
        saldoAcumulado,
      });
    }

    const margens = projecaoMensal.map((linha) => linha.margemPercentual);
    const projecaoResumo = {
      margemMinimaPercentual: Math.min(...margens),
      margemMaximaPercentual: Math.max(...margens),
      receitaTotal: arredondar(receitaPorMes.reduce((soma, valor) => soma + valor, 0)),
      saldoAcumuladoFinal: saldoAcumulado,
      custoDiretoSobreReceitaPercentual: arredondar(
        (custoDiretoPorMes.reduce((soma, valor) => soma + valor, 0) /
          receitaPorMes.reduce((soma, valor) => soma + valor, 0)) *
          100,
        1
      ),
    };

    const resumo = {
      cliente: { total: clientesPlano.length, novos: clientesNovos.length, jaExistentes: clientesExistentes.length },
      produto: { total: produtosPlano.length, novos: produtosNovos.length, jaExistentes: produtosExistentes.length },
      ordemServico: ordens.length,
      itemOS: itensOs.length,
      termoGarantiaOS: termos.length,
      retornoGarantiaOS: retornos.length,
      caixaSession: sessoes.length,
      venda: vendas.length,
      itemVenda: itensVenda.length,
      vendaPagamento: pagamentos.length,
      contaReceber: contasReceber.length,
      despesa: despesas.length,
      parcelaDespesa: parcelas.length,
    };

    const distribuicaoStatusOS = {};
    for (const os of ordens) {
      distribuicaoStatusOS[os.status] = (distribuicaoStatusOS[os.status] ?? 0) + 1;
    }

    const distribuicaoParcelas = { PAGO: 0, PENDENTE: 0, ATRASADO: 0, VENCIDAS_EM_ABERTO: 0 };
    for (const p of parcelas) {
      distribuicaoParcelas[p.status] += 1;
      if (p.status !== "PAGO" && p.dataVencimento.getTime() < AGORA.getTime()) {
        distribuicaoParcelas.VENCIDAS_EM_ABERTO += 1;
      }
    }

    const distribuicaoContas = {};
    for (const c of contasReceber) {
      distribuicaoContas[c.status] = (distribuicaoContas[c.status] ?? 0) + 1;
    }

    function imprimirProjecaoMensal() {
      console.log("Projecao financeira mes a mes (mesma regra do dashboard):");
      console.table(projecaoMensal);
      console.log(JSON.stringify(projecaoResumo, null, 2));
      console.log("");
    }

    if (!confirmar) {
      console.log("DRY-RUN: nada foi escrito. Seria criado:");
      console.log(JSON.stringify({ resumo, distribuicaoStatusOS, distribuicaoContas, distribuicaoParcelas }, null, 2));
      console.log("");
      imprimirProjecaoMensal();
      console.log("Para gravar de verdade, rode novamente com --confirm.");
      return;
    }

    // --- Escrita na ordem das chaves estrangeiras ---
    const criados = {
      cliente: clientesNovos.length,
      produto: produtosNovos.length,
    };

    const idsOs = new Map(ordens.map((os) => [os.chave, idDemo()]));
    criados.ordemServico = await criarEmLotes(
      prisma.ordemServico,
      ordens.map((os) => ({
        id: idsOs.get(os.chave),
        clienteId: os.clienteId,
        equipamento: os.equipamento,
        marca: os.marca,
        modelo: os.modelo,
        imei: os.imei,
        senha: os.senha,
        senhaDesenho: os.senhaDesenho,
        relatoCliente: os.relatoCliente,
        condicaoFisica: os.condicaoFisica,
        acessorios: os.acessorios,
        status: os.status,
        ehRetornoGarantia: os.ehRetornoGarantia,
        observacoes: os.observacoes,
        prazoGarantiaDias: os.prazoGarantiaDias,
        criadoEm: os.criadoEm,
        atualizadoEm: os.atualizadoEm,
      }))
    );

    criados.itemOS = await criarEmLotes(
      prisma.itemOS,
      itensOs.map((item) => ({
        id: idDemo(),
        osId: idsOs.get(item.osChave),
        descricao: item.descricao,
        tipoPeca: item.tipoPeca,
        custoPeca: item.custoPeca,
        valorCobrado: item.valorCobrado,
        criadoEm: item.criadoEm,
      }))
    );

    const idsTermos = new Map(termos.map((t) => [t.chave, idDemo()]));
    criados.termoGarantiaOS = await criarEmLotes(
      prisma.termoGarantiaOS,
      termos.map((t) => ({
        id: idsTermos.get(t.chave),
        osId: idsOs.get(t.osChave),
        prazoGarantiaDias: t.prazoGarantiaDias,
        dataInicioGarantia: t.dataInicioGarantia,
        dataFimGarantia: t.dataFimGarantia,
        textoGarantia: t.textoGarantia,
        criadoEm: t.criadoEm,
        atualizadoEm: t.atualizadoEm,
      }))
    );

    criados.retornoGarantiaOS = await criarEmLotes(
      prisma.retornoGarantiaOS,
      retornos.map((r) => ({
        id: idDemo(),
        termoGarantiaId: idsTermos.get(r.termoChave),
        osOrigemId: r.osOrigemChave ? idsOs.get(r.osOrigemChave) : null,
        motivo: r.motivo,
        descricao: r.descricao,
        analiseTecnica: r.analiseTecnica,
        resultado: r.resultado,
        descricaoServico: r.descricaoServico,
        pecasAdicionais: r.pecasAdicionais,
        houveTroca: r.houveTroca,
        houveCobranca: r.houveCobranca,
        valorAdicional: r.valorAdicional,
        finalizadoEm: r.finalizadoEm,
        criadoEm: r.criadoEm,
        atualizadoEm: r.atualizadoEm,
      }))
    );

    const idsSessoes = new Map(sessoes.map((s) => [s.chave, idDemo()]));
    criados.caixaSession = await criarEmLotes(
      prisma.caixaSession,
      sessoes.map((s) => ({
        id: idsSessoes.get(s.chave),
        status: s.status,
        valorAbertura: s.valorAbertura,
        valorFechamento: s.valorFechamento,
        dataAbertura: s.dataAbertura,
        dataFechamento: s.dataFechamento,
        criadoEm: s.criadoEm,
        atualizadoEm: s.atualizadoEm,
      }))
    );

    const idsVendas = new Map(vendas.map((v) => [v.chave, idDemo()]));
    criados.venda = await criarEmLotes(
      prisma.venda,
      vendas.map((v) => ({
        id: idsVendas.get(v.chave),
        clienteId: v.clienteId,
        formaPagamento: v.formaPagamento,
        valorTotal: v.valorTotal,
        desconto: v.desconto,
        criadoEm: v.criadoEm,
        caixaSessionId: idsSessoes.get(v.caixaChave),
      }))
    );

    criados.itemVenda = await criarEmLotes(
      prisma.itemVenda,
      itensVenda.map((i) => ({
        id: idDemo(),
        vendaId: idsVendas.get(i.vendaChave),
        produtoId: mapaProdutos.get(i.produtoChave) ?? null,
        descricao: i.descricao,
        quantidade: i.quantidade,
        custoUnitario: i.custoUnitario,
        precoUnitario: i.precoUnitario,
        subtotal: i.subtotal,
      }))
    );

    const idsPagamentos = new Map(pagamentos.map((p) => [p.chave, idDemo()]));
    criados.vendaPagamento = await criarEmLotes(
      prisma.vendaPagamento,
      pagamentos.map((p) => ({
        id: idsPagamentos.get(p.chave),
        vendaId: idsVendas.get(p.vendaChave),
        formaPagamento: p.formaPagamento,
        valorBruto: p.valorBruto,
        percentualTaxa: p.percentualTaxa,
        valorTaxa: p.valorTaxa,
        valorLiquido: p.valorLiquido,
        parcelas: p.parcelas,
        diasVencimento: p.diasVencimento,
        dataVencimento: p.dataVencimento,
        criadoEm: p.criadoEm,
        atualizadoEm: p.atualizadoEm,
      }))
    );

    criados.contaReceber = await criarEmLotes(
      prisma.contaReceber,
      contasReceber.map((c) => ({
        id: idDemo(),
        descricao: c.descricao,
        valor: c.valor,
        clienteId: c.clienteId ?? null,
        ordemServicoId: c.osChave ? idsOs.get(c.osChave) : null,
        vendaId: c.vendaChave ? idsVendas.get(c.vendaChave) : null,
        vendaPagamentoId: c.pagamentoChave ? idsPagamentos.get(c.pagamentoChave) : null,
        dataVencimento: c.dataVencimento,
        dataRecebimento: c.dataRecebimento,
        status: c.status,
        formaPagamento: c.formaPagamento,
        formaRecebimento: c.formaRecebimento,
        origem: c.origem,
        criadoEm: c.criadoEm,
        atualizadoEm: c.atualizadoEm,
      }))
    );

    const idsDespesas = new Map(despesas.map((d) => [d.chave, idDemo()]));
    criados.despesa = await criarEmLotes(
      prisma.despesa,
      despesas.map((d) => ({
        id: idsDespesas.get(d.chave),
        fornecedor: d.fornecedor,
        descricao: d.descricao,
        valorTotal: d.valorTotal,
        tipo: d.tipo,
        qtdParcelas: d.qtdParcelas,
        clienteId: d.clienteId,
        criadoEm: d.criadoEm,
        atualizadoEm: d.atualizadoEm,
      }))
    );

    criados.parcelaDespesa = await criarEmLotes(
      prisma.parcelaDespesa,
      parcelas.map((p) => ({
        id: idDemo(),
        despesaId: idsDespesas.get(p.despesaChave),
        numeroParcela: p.numeroParcela,
        valor: p.valor,
        dataVencimento: p.dataVencimento,
        dataPagamento: p.dataPagamento,
        status: p.status,
        valorPago: p.valorPago,
        criadoEm: p.criadoEm,
      }))
    );

    console.log("CONFIRM: linhas criadas por tabela:");
    console.log(JSON.stringify(criados, null, 2));
    console.log("");
    console.log("Distribuicao de status das OS criadas:");
    console.log(JSON.stringify(distribuicaoStatusOS, null, 2));
    console.log("");
    imprimirProjecaoMensal();
    console.log("Seed concluido no banco de TESTE.");
  } finally {
    await prisma.$disconnect();
  }
}

executar().catch((erro) => {
  console.error(erro instanceof Error ? erro.message : "Falha desconhecida ao popular o tenant de demonstracao.");
  process.exit(1);
});
