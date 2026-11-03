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
