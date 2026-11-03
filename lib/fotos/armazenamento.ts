/**
 * Armazenamento de arquivos no Cloudflare R2.
 *
 * O R2 fala a API do S3, então o cliente é o `@aws-sdk/client-s3` apontado
 * para o endpoint da conta. `region: "auto"` é o que o R2 espera — ele não tem
 * regiões como a AWS, mas a assinatura do S3 exige o campo.
 *
 * A resolução das variáveis é PREGUIÇOSA de propósito, pelo mesmo motivo de
 * `lib/prisma.ts`: importar este módulo nunca pode lançar. Um `throw` no escopo
 * do módulo quebraria o `next build` na coleta de páginas de qualquer rota que
 * o importasse, mesmo as que não usam foto nenhuma. O erro só aparece no
 * primeiro uso real.
 */

import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export type ConfiguracaoArmazenamento = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
};

export type ResultadoConfiguracao =
  | { ok: true; configuracao: ConfiguracaoArmazenamento }
  | { ok: false; faltando: string[] };

const VARIAVEIS = [
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET",
] as const;

/**
 * Lê as quatro variáveis. Devolve QUAIS faltam, não só "não configurado":
 * saber que falta exatamente `R2_BUCKET` é a diferença entre consertar em um
 * minuto e caçar o problema nos quatro.
 */
export function lerConfiguracaoArmazenamento(): ResultadoConfiguracao {
  const faltando = VARIAVEIS.filter((nome) => {
    const valor = process.env[nome];
    return typeof valor !== "string" || valor.trim().length === 0;
  });

  if (faltando.length > 0) return { ok: false, faltando: [...faltando] };

  return {
    ok: true,
    configuracao: {
      accountId: process.env.R2_ACCOUNT_ID!.trim(),
      accessKeyId: process.env.R2_ACCESS_KEY_ID!.trim(),
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!.trim(),
      bucket: process.env.R2_BUCKET!.trim(),
    },
  };
}

/** `true` quando as quatro variáveis existem — não diz se elas funcionam. */
export function armazenamentoEstaConfigurado(): boolean {
  return lerConfiguracaoArmazenamento().ok;
}

// ── Formato das credenciais ───────────────────────────────────────────────────

/**
 * O R2 tem formato fixo para três dos quatro valores, e conferir isso aqui
 * evita uma viagem ao servidor da Cloudflare para descobrir um erro de
 * copiar e colar.
 *
 * Existe porque aconteceu: o `R2_ACCESS_KEY_ID` foi preenchido com 53
 * caracteres e o SDK recusou com `Credential access key has length 53, should
 * be 32` — uma mensagem correta, em inglês, e sem dizer onde estava o valor
 * certo. A página que a Cloudflare mostra ao criar um token do R2 tem TRÊS
 * valores (Token value, Access Key ID e Secret Access Key), e o de cima não é
 * o que o S3 usa.
 */
export type ProblemaDeFormato = {
  variavel: string;
  /** O que há de errado, em português, sem jamais citar o valor. */
  problema: string;
};

const HEXADECIMAL = /^[0-9a-f]+$/i;

function conferirHex(
  variavel: string,
  valor: string,
  tamanhoEsperado: number,
  ondeEncontrar: string
): ProblemaDeFormato | null {
  if (valor.length !== tamanhoEsperado) {
    return {
      variavel,
      problema: `tem ${valor.length} caracteres e precisa ter exatamente ${tamanhoEsperado}. ${ondeEncontrar}`,
    };
  }

  if (!HEXADECIMAL.test(valor)) {
    return {
      variavel,
      problema: `tem o tamanho certo mas contém caracteres que não existem nesse campo — ele só usa números e as letras de A a F. ${ondeEncontrar}`,
    };
  }

  return null;
}

/**
 * Confere o formato do que está configurado. Lista vazia significa que o
 * formato está plausível — não que a credencial seja válida, o que só o
 * diagnóstico responde.
 *
 * Nunca devolve, registra ou exibe o VALOR de nada: só tamanho e formato.
 */
export function conferirFormatoDasCredenciais(): ProblemaDeFormato[] {
  const resultado = lerConfiguracaoArmazenamento();
  if (!resultado.ok) return [];

  const { accountId, accessKeyId, secretAccessKey, bucket } = resultado.configuracao;
  const problemas: Array<ProblemaDeFormato | null> = [];

  problemas.push(
    conferirHex(
      "R2_ACCOUNT_ID",
      accountId,
      32,
      "É o Account ID da conta Cloudflare, que aparece na barra lateral da página do R2."
    )
  );

  problemas.push(
    conferirHex(
      "R2_ACCESS_KEY_ID",
      accessKeyId,
      32,
      'Na página do token do R2 é o campo "Access Key ID" — não o "Token value", que fica acima e é maior.'
    )
  );

  problemas.push(
    conferirHex(
      "R2_SECRET_ACCESS_KEY",
      secretAccessKey,
      64,
      'Na página do token do R2 é o campo "Secret Access Key". Ele aparece uma única vez; se não tiver mais, gere um token novo.'
    )
  );

  // O bucket é nome livre, mas o R2 não aceita maiúscula — e um nome digitado
  // com maiúscula falharia depois com "NoSuchBucket", que manda procurar no
  // lugar errado.
  if (bucket !== bucket.toLowerCase()) {
    problemas.push({
      variavel: "R2_BUCKET",
      problema:
        "tem letra maiúscula, e nome de bucket do R2 é sempre minúsculo. Copie exatamente como aparece na lista do R2.",
    });
  }

  return problemas.filter((problema): problema is ProblemaDeFormato => problema !== null);
}

let clienteEmCache: { chave: string; cliente: S3Client } | null = null;

/**
 * O cliente é reaproveitado entre invocações da mesma instância (ele mantém o
 * pool de conexões). A chave de cache inclui a conta e o bucket pra que uma
 * troca de variável de ambiente não continue usando o cliente antigo.
 */
function obterCliente(configuracao: ConfiguracaoArmazenamento): S3Client {
  const chave = `${configuracao.accountId}/${configuracao.bucket}/${configuracao.accessKeyId}`;

  if (clienteEmCache?.chave === chave) return clienteEmCache.cliente;

  const cliente = new S3Client({
    region: "auto",
    endpoint: `https://${configuracao.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: configuracao.accessKeyId,
      secretAccessKey: configuracao.secretAccessKey,
    },
  });

  clienteEmCache = { chave, cliente };
  return cliente;
}

export class ErroArmazenamento extends Error {}

function exigirConfiguracao(): ConfiguracaoArmazenamento {
  const resultado = lerConfiguracaoArmazenamento();

  if (!resultado.ok) {
    throw new ErroArmazenamento(
      `Armazenamento de arquivos não configurado. Faltando: ${resultado.faltando.join(", ")}.`
    );
  }

  return resultado.configuracao;
}

export async function gravarObjeto(entrada: {
  chave: string;
  corpo: Uint8Array;
  tipoConteudo: string;
}): Promise<void> {
  const configuracao = exigirConfiguracao();

  await obterCliente(configuracao).send(
    new PutObjectCommand({
      Bucket: configuracao.bucket,
      Key: entrada.chave,
      Body: entrada.corpo,
      ContentType: entrada.tipoConteudo,
    })
  );
}

export async function lerObjetoComoTexto(chave: string): Promise<string> {
  const configuracao = exigirConfiguracao();

  const resposta = await obterCliente(configuracao).send(
    new GetObjectCommand({ Bucket: configuracao.bucket, Key: chave })
  );

  if (!resposta.Body) {
    throw new ErroArmazenamento("O objeto voltou sem conteúdo.");
  }

  return resposta.Body.transformToString();
}

export async function apagarObjeto(chave: string): Promise<void> {
  const configuracao = exigirConfiguracao();

  await obterCliente(configuracao).send(
    new DeleteObjectCommand({ Bucket: configuracao.bucket, Key: chave })
  );
}

/**
 * Validade curta de propósito. A URL assinada é um link que dá acesso ao
 * arquivo a quem o tiver — e foto de aparelho de cliente é dado de terceiro.
 * Quinze minutos cobrem abrir a OS e olhar as fotos; não cobrem um link
 * reencaminhado amanhã.
 */
export const VALIDADE_DA_URL_EM_SEGUNDOS = 15 * 60;

export async function gerarUrlDeLeitura(
  chave: string,
  validadeEmSegundos: number = VALIDADE_DA_URL_EM_SEGUNDOS
): Promise<string> {
  const configuracao = exigirConfiguracao();

  return getSignedUrl(
    obterCliente(configuracao),
    new GetObjectCommand({ Bucket: configuracao.bucket, Key: chave }),
    { expiresIn: validadeEmSegundos }
  );
}

// ── Diagnóstico ───────────────────────────────────────────────────────────────

export type ResultadoDiagnostico = {
  gravou: boolean;
  leu: boolean;
  apagou: boolean;
  /** Mensagem em português, com o que fazer. `null` quando tudo passou. */
  erro: string | null;
  /** Nome da etapa que falhou, pra tela destacar. */
  etapaQueFalhou: "GRAVAR" | "LER" | "APAGAR" | "CONFIGURACAO" | null;
};

/**
 * Traduz o erro do SDK para o que fazer a respeito.
 *
 * Vale o trabalho porque cada falha aqui tem uma causa diferente e um conserto
 * diferente, e a mensagem crua (`SignatureDoesNotMatch`, `NoSuchBucket`) não
 * diz qual das quatro variáveis está errada. Sem isso, "não funcionou" manda
 * conferir as quatro no escuro.
 */
export function traduzirErroDeArmazenamento(erro: unknown): string {
  const nome = erro instanceof Error ? erro.name : "";
  const mensagem = erro instanceof Error ? erro.message : String(erro);
  const texto = `${nome} ${mensagem}`;

  // O SDK confere o TAMANHO da chave antes de sair pela rede, então este erro
  // chega sem nenhuma conversa com a Cloudflare. Aconteceu de verdade, com uma
  // chave de 53 caracteres: é o "Token value" da página do token sendo
  // confundido com o "Access Key ID", que fica logo abaixo dele.
  const tamanhoErrado = /Credential access key has length (\d+), should be (\d+)/i.exec(texto);
  if (tamanhoErrado) {
    return `O R2_ACCESS_KEY_ID tem ${tamanhoErrado[1]} caracteres e precisa ter exatamente ${tamanhoErrado[2]}. Na página do token do R2, é o campo "Access Key ID" — não o "Token value", que fica acima e é maior.`;
  }

  if (/ENOTFOUND|EAI_AGAIN|getaddrinfo|Could not resolve/i.test(texto)) {
    return "Não foi possível alcançar o endereço do R2. O R2_ACCOUNT_ID provavelmente está errado — ele é o Account ID da conta Cloudflare, não o nome do bucket.";
  }

  if (/InvalidAccessKeyId/i.test(texto)) {
    return "O R2_ACCESS_KEY_ID não é reconhecido. Confira se copiou o Access Key ID inteiro, ou gere um token novo no R2.";
  }

  if (/SignatureDoesNotMatch/i.test(texto)) {
    return "A assinatura não fecha: o R2_SECRET_ACCESS_KEY está errado ou incompleto. Esse valor aparece uma única vez na Cloudflare — se não tiver mais, gere um token novo.";
  }

  if (/NoSuchBucket/i.test(texto)) {
    return "O bucket não existe nessa conta. Confira o R2_BUCKET — tem que ser exatamente o nome que aparece na lista do R2, com as mesmas letras.";
  }

  if (/AccessDenied|Forbidden|403/i.test(texto)) {
    return "A credencial foi aceita, mas não tem permissão para esta operação. No token do R2, a permissão precisa ser Object Read & Write, e o bucket escolhido precisa ser o mesmo do R2_BUCKET.";
  }

  if (/NoSuchKey/i.test(texto)) {
    return "O arquivo foi gravado mas não foi encontrado na leitura. Isso costuma ser token com permissão de escrita e não de leitura.";
  }

  if (/NetworkingError|TimeoutError|ETIMEDOUT|ECONNRESET/i.test(texto)) {
    return "A conexão com o R2 falhou ou expirou. Pode ser instabilidade momentânea — tente de novo em alguns segundos.";
  }

  return `Falha inesperada ao falar com o R2: ${mensagem}`;
}

/**
 * Grava um arquivo de teste, lê de volta, confere o conteúdo e apaga.
 *
 * Existe porque este projeto não tem ambiente de Preview: a primeira vez que o
 * código fala com o R2 é em produção. Melhor que isso aconteça num arquivo de
 * três linhas, sob um prefixo próprio, do que no meio do atendimento de um
 * cliente com a foto do aparelho dele.
 *
 * Testa as três operações separadamente porque elas falham por motivos
 * diferentes: um token só de escrita grava e não lê, e um token sem delete
 * grava, lê e deixa lixo para trás.
 */
export async function diagnosticarArmazenamento(): Promise<ResultadoDiagnostico> {
  const configuracao = lerConfiguracaoArmazenamento();

  if (!configuracao.ok) {
    return {
      gravou: false,
      leu: false,
      apagou: false,
      etapaQueFalhou: "CONFIGURACAO",
      erro: `Faltam variáveis de ambiente no Vercel: ${configuracao.faltando.join(", ")}.`,
    };
  }

  // Formato antes da rede: um valor com o tamanho errado seria recusado pelo
  // próprio SDK, e a mensagem dele ("Credential access key has length 53")
  // aparece como falha ao GRAVAR, o que faz procurar permissão de escrita
  // quando o problema é um campo copiado errado.
  const problemas = conferirFormatoDasCredenciais();

  if (problemas.length > 0) {
    return {
      gravou: false,
      leu: false,
      apagou: false,
      etapaQueFalhou: "CONFIGURACAO",
      erro: problemas.map((item) => `${item.variavel} ${item.problema}`).join(" "),
    };
  }

  // Prefixo próprio e nome único: nunca colide com arquivo de verdade, e dois
  // diagnósticos ao mesmo tempo não atropelam um ao outro.
  const chave = `diagnostico/${crypto.randomUUID()}.txt`;
  const conteudo = `konext-diagnostico ${new Date().toISOString()}`;

  try {
    await gravarObjeto({
      chave,
      corpo: new TextEncoder().encode(conteudo),
      tipoConteudo: "text/plain; charset=utf-8",
    });
  } catch (erro) {
    return {
      gravou: false,
      leu: false,
      apagou: false,
      etapaQueFalhou: "GRAVAR",
      erro: traduzirErroDeArmazenamento(erro),
    };
  }

  let leu = false;

  try {
    const lido = await lerObjetoComoTexto(chave);

    // Confere o CONTEÚDO, não só que a leitura respondeu: um bucket apontado
    // para o lugar errado poderia devolver outro arquivo.
    if (lido.trim() !== conteudo) {
      throw new ErroArmazenamento("O conteúdo lido não é o que foi gravado.");
    }

    leu = true;
  } catch (erro) {
    // Tenta limpar mesmo tendo falhado na leitura: senão o arquivo de teste
    // fica no bucket a cada tentativa de diagnóstico.
    await apagarObjeto(chave).catch(() => undefined);

    return {
      gravou: true,
      leu: false,
      apagou: false,
      etapaQueFalhou: "LER",
      erro: traduzirErroDeArmazenamento(erro),
    };
  }

  try {
    await apagarObjeto(chave);
  } catch (erro) {
    return {
      gravou: true,
      leu,
      apagou: false,
      etapaQueFalhou: "APAGAR",
      erro: `${traduzirErroDeArmazenamento(erro)} O arquivo de teste ${chave} ficou no bucket.`,
    };
  }

  return { gravou: true, leu: true, apagou: true, etapaQueFalhou: null, erro: null };
}
