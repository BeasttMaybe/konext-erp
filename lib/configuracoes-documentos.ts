import type { DadosConfiguracoes } from "@/app/actions/configuracoes";

export type ConfiguracaoEmpresaDocumentos = Pick<
  DadosConfiguracoes,
  | "razaoSocial"
  | "nomeFantasia"
  | "cnpj"
  | "telefone"
  | "cep"
  | "logradouro"
  | "numero"
  | "bairro"
  | "cidade"
  | "estado"
  | "endereco"
  | "logoUrl"
  | "mensagemCupom"
>;

export type ResumoEmpresaDocumentos = {
  nomeExibicao: string;
  razaoSocial: string;
  cnpj: string;
  telefone: string;
  cidadeUf: string;
  endereco: string;
  logoUrl: string;
  mensagemCupom: string;
  status: "completa" | "parcial" | "pendente";
};

export const CAMPOS_EMPRESA_PLANEJADOS = {
  contato: ["WhatsApp", "E-mail", "Site"],
  endereco: ["Complemento"],
} as const;

export const CAMPOS_DOCUMENTOS_PLANEJADOS = [
  "Mensagem padrão da proposta",
  "Mensagem padrão da OS",
  "Mensagem padrão do termo de garantia",
  "Rodapé padrão dos documentos",
  "Cabeçalho padrão dos documentos",
] as const;

function limparTexto(valor: string | null | undefined): string {
  return String(valor ?? "").trim();
}

function somenteDigitos(valor: string | null | undefined): string {
  return limparTexto(valor).replace(/\D/g, "");
}

function normalizarLogoUrl(valor: string | null | undefined): string {
  const url = limparTexto(valor);

  if (!url) {
    return "";
  }

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return "";
    }

    return parsed.toString();
  } catch {
    return "";
  }
}

export function formatarCnpjVisual(valor: string | null | undefined): string {
  const digitos = somenteDigitos(valor).slice(0, 14);

  if (digitos.length <= 2) return digitos;
  if (digitos.length <= 5) return `${digitos.slice(0, 2)}.${digitos.slice(2)}`;
  if (digitos.length <= 8) return `${digitos.slice(0, 2)}.${digitos.slice(2, 5)}.${digitos.slice(5)}`;
  if (digitos.length <= 12) {
    return `${digitos.slice(0, 2)}.${digitos.slice(2, 5)}.${digitos.slice(5, 8)}/${digitos.slice(8)}`;
  }

  return `${digitos.slice(0, 2)}.${digitos.slice(2, 5)}.${digitos.slice(5, 8)}/${digitos.slice(8, 12)}-${digitos.slice(12)}`;
}

export function formatarCepVisual(valor: string | null | undefined): string {
  const digitos = somenteDigitos(valor).slice(0, 8);

  if (digitos.length <= 5) {
    return digitos;
  }

  return `${digitos.slice(0, 5)}-${digitos.slice(5)}`;
}

export function formatarTelefoneVisual(valor: string | null | undefined): string {
  const digitos = somenteDigitos(valor).slice(0, 11);

  if (digitos.length <= 2) return digitos;
  if (digitos.length <= 6) return `(${digitos.slice(0, 2)}) ${digitos.slice(2)}`;
  if (digitos.length <= 10) {
    return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 6)}-${digitos.slice(6)}`;
  }

  return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7)}`;
}

export function montarCidadeUf(configuracao: Partial<ConfiguracaoEmpresaDocumentos> | null | undefined): string {
  const cidadeUf = [limparTexto(configuracao?.cidade), limparTexto(configuracao?.estado)]
    .filter(Boolean)
    .join("/");

  return cidadeUf || "Cidade/UF não informada";
}

/**
 * O endereco da empresa para documentos.
 *
 * QUEM GANHA, E POR QUE ISTO MUDOU
 *
 * Antes, o campo de texto livre "Endereco" ganhava SEMPRE. Resultado: o dono
 * preenchia CEP, logradouro, numero, bairro, cidade e estado -- seis campos
 * -- e nada disso aparecia em documento nenhum enquanto o texto livre
 * estivesse preenchido. O CEP, que so existe no formato estruturado, nunca
 * aparecia em lugar algum.
 *
 * Agora ganha o endereco MONTADO a partir dos campos, que e o mais completo
 * (tem CEP) e o unico que serve para nota fiscal depois.
 *
 * A TROCA SO VALE COM LOGRADOURO
 *
 * Um endereco montado so de "Sao Paulo - SP" e pior que um texto livre
 * completo. Entao a inversao exige que exista RUA: sem ela, o texto livre
 * continua mandando, e quem nunca preencheu os campos separados nao ve o
 * endereco do seu documento encolher sozinho.
 */
export function montarEnderecoEmpresa(configuracao: Partial<ConfiguracaoEmpresaDocumentos> | null | undefined): string {
  const enderecoDireto = limparTexto(configuracao?.endereco);
  const temLogradouro = Boolean(limparTexto(configuracao?.logradouro));

  const ruaNumero = [limparTexto(configuracao?.logradouro), limparTexto(configuracao?.numero)]
    .filter(Boolean)
    .join(", ");
  const bairro = limparTexto(configuracao?.bairro);
  const cidadeUf = [limparTexto(configuracao?.cidade), limparTexto(configuracao?.estado)]
    .filter(Boolean)
    .join(" - ");
  const cep = formatarCepVisual(configuracao?.cep);

  const endereco = [ruaNumero, bairro, cidadeUf, cep ? `CEP ${cep}` : ""]
    .filter(Boolean)
    .join(" | ");

  if (temLogradouro && endereco) {
    return endereco;
  }

  return enderecoDireto || endereco || "Endereço não informado";
}

export function montarResumoEmpresaDocumentos(
  configuracao: Partial<ConfiguracaoEmpresaDocumentos> | null | undefined
): ResumoEmpresaDocumentos {
  const nomeFantasia = limparTexto(configuracao?.nomeFantasia);
  const razaoSocial = limparTexto(configuracao?.razaoSocial);
  const cnpj = formatarCnpjVisual(configuracao?.cnpj);
  const telefone = formatarTelefoneVisual(configuracao?.telefone);
  const endereco = montarEnderecoEmpresa(configuracao);
  const cidadeUf = montarCidadeUf(configuracao);
  const logoUrl = normalizarLogoUrl(configuracao?.logoUrl);
  const mensagemCupom = limparTexto(configuracao?.mensagemCupom);
  const camposPreenchidos = [nomeFantasia || razaoSocial, cnpj, telefone, endereco !== "Endereço não informado", logoUrl]
    .filter(Boolean)
    .length;

  return {
    nomeExibicao: nomeFantasia || razaoSocial || "Empresa não configurada",
    razaoSocial: razaoSocial || "Razão social não informada",
    cnpj: cnpj || "CNPJ não informado",
    telefone: telefone || "Telefone não informado",
    cidadeUf,
    endereco,
    logoUrl,
    mensagemCupom,
    status: camposPreenchidos >= 4 ? "completa" : camposPreenchidos >= 2 ? "parcial" : "pendente",
  };
}