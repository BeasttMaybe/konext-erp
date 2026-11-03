import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  armazenamentoEstaConfigurado,
  conferirFormatoDasCredenciais,
  lerConfiguracaoArmazenamento,
  traduzirErroDeArmazenamento,
} from "./armazenamento";

/**
 * Só as partes puras: leitura das variáveis e tradução de erro. A conversa com
 * o R2 em si é testada pelo diagnóstico da tela de Configurações, contra o
 * bucket de verdade — é o único lugar onde "a credencial funciona" é uma
 * pergunta respondível.
 */

const VARIAVEIS = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET"];

const original = new Map<string, string | undefined>();

beforeEach(() => {
  for (const nome of VARIAVEIS) {
    original.set(nome, process.env[nome]);
    delete process.env[nome];
  }
});

afterEach(() => {
  for (const nome of VARIAVEIS) {
    const valor = original.get(nome);
    if (valor === undefined) delete process.env[nome];
    else process.env[nome] = valor;
  }
});

function definirTodas() {
  process.env.R2_ACCOUNT_ID = "conta123";
  process.env.R2_ACCESS_KEY_ID = "chave123";
  process.env.R2_SECRET_ACCESS_KEY = "segredo123";
  process.env.R2_BUCKET = "konext-os-fotos";
}

describe("fotos/armazenamento — leitura das variáveis", () => {
  it("diz QUAIS faltam, não só que falta algo", () => {
    // Saber que falta exatamente R2_BUCKET é a diferença entre consertar em um
    // minuto e conferir as quatro no escuro.
    const resultado = lerConfiguracaoArmazenamento();

    expect(resultado.ok).toBe(false);
    expect(resultado.ok === false && resultado.faltando).toEqual(VARIAVEIS);
  });

  it("aponta só a que falta quando as outras estão lá", () => {
    definirTodas();
    delete process.env.R2_BUCKET;

    const resultado = lerConfiguracaoArmazenamento();

    expect(resultado.ok === false && resultado.faltando).toEqual(["R2_BUCKET"]);
  });

  it("trata variável em branco como ausente", () => {
    // Variável criada no painel e salva vazia é um caso real, e "" passaria
    // por uma checagem de `undefined`.
    definirTodas();
    process.env.R2_SECRET_ACCESS_KEY = "   ";

    const resultado = lerConfiguracaoArmazenamento();

    expect(resultado.ok === false && resultado.faltando).toEqual(["R2_SECRET_ACCESS_KEY"]);
  });

  it("devolve a configuração com os valores aparados", () => {
    definirTodas();
    process.env.R2_BUCKET = "  konext-os-fotos  ";

    const resultado = lerConfiguracaoArmazenamento();

    expect(resultado.ok).toBe(true);
    expect(resultado.ok === true && resultado.configuracao.bucket).toBe("konext-os-fotos");
    expect(armazenamentoEstaConfigurado()).toBe(true);
  });

  it("não está configurado quando falta qualquer uma", () => {
    definirTodas();
    delete process.env.R2_ACCOUNT_ID;

    expect(armazenamentoEstaConfigurado()).toBe(false);
  });
});

describe("fotos/armazenamento — tradução de erro", () => {
  /**
   * Cada uma destas falhas tem uma causa diferente e um conserto diferente, e
   * a mensagem crua do SDK não diz qual das quatro variáveis está errada.
   */
  const casos: Array<[string, string, string]> = [
    ["endereço não resolve", "getaddrinfo ENOTFOUND conta.r2.cloudflarestorage.com", "R2_ACCOUNT_ID"],
    ["chave não reconhecida", "InvalidAccessKeyId: nope", "R2_ACCESS_KEY_ID"],
    ["assinatura não fecha", "SignatureDoesNotMatch", "R2_SECRET_ACCESS_KEY"],
    ["bucket não existe", "NoSuchBucket: missing", "R2_BUCKET"],
    ["sem permissão", "AccessDenied", "Object Read & Write"],
    ["objeto não encontrado", "NoSuchKey", "leitura"],
  ];

  it.each(casos)("em %s, aponta o que consertar", (_rotulo, mensagemCrua, trechoEsperado) => {
    const erro = new Error(mensagemCrua);
    erro.name = mensagemCrua.split(":")[0];

    expect(traduzirErroDeArmazenamento(erro)).toContain(trechoEsperado);
  });

  it("erro desconhecido não é engolido: a mensagem original aparece", () => {
    // Traduzir o que se conhece e esconder o resto deixaria uma falha nova sem
    // nenhuma pista.
    const traduzido = traduzirErroDeArmazenamento(new Error("algo muito estranho aconteceu"));

    expect(traduzido).toContain("algo muito estranho aconteceu");
  });

  it("aceita o que não é Error", () => {
    expect(traduzirErroDeArmazenamento("texto solto")).toContain("texto solto");
  });
});

describe("fotos/armazenamento — formato das credenciais", () => {
  function definirValidas() {
    process.env.R2_ACCOUNT_ID = "a".repeat(32);
    process.env.R2_ACCESS_KEY_ID = "0123456789abcdef0123456789abcdef";
    process.env.R2_SECRET_ACCESS_KEY = "f".repeat(64);
    process.env.R2_BUCKET = "konext-os-fotos";
  }

  it("credenciais no formato certo não geram problema", () => {
    definirValidas();

    expect(conferirFormatoDasCredenciais()).toEqual([]);
  });

  /**
   * O caso real: o campo "Token value" da página do token do R2 foi colado no
   * lugar do "Access Key ID". O SDK recusa com "Credential access key has
   * length 53, should be 32" — correto, em inglês, e sem dizer onde está o
   * valor certo.
   */
  it("aponta o Access Key ID com tamanho errado, e onde achar o certo", () => {
    definirValidas();
    process.env.R2_ACCESS_KEY_ID = "x".repeat(53);

    const [problema] = conferirFormatoDasCredenciais();

    expect(problema.variavel).toBe("R2_ACCESS_KEY_ID");
    expect(problema.problema).toContain("53 caracteres");
    expect(problema.problema).toContain("32");
    expect(problema.problema).toContain("Token value");
  });

  it("nunca devolve o valor de nada, só tamanho e formato", () => {
    // O painel exibe isto na tela: se o valor vazasse aqui, uma credencial
    // apareceria em Configurações.
    const segredo = "9".repeat(70);
    definirValidas();
    process.env.R2_SECRET_ACCESS_KEY = segredo;

    const texto = JSON.stringify(conferirFormatoDasCredenciais());

    expect(texto).not.toContain(segredo);
    expect(texto).toContain("R2_SECRET_ACCESS_KEY");
  });

  it("pega o tamanho certo com alfabeto errado", () => {
    definirValidas();
    // 32 caracteres, mas com "z" — que não existe em hexadecimal.
    process.env.R2_ACCESS_KEY_ID = `z${"a".repeat(31)}`;

    const [problema] = conferirFormatoDasCredenciais();

    expect(problema.variavel).toBe("R2_ACCESS_KEY_ID");
    expect(problema.problema).toContain("A a F");
  });

  it("pega bucket com maiúscula", () => {
    // Falharia depois com NoSuchBucket, que manda procurar no lugar errado.
    definirValidas();
    process.env.R2_BUCKET = "Konext-OS-Fotos";

    const [problema] = conferirFormatoDasCredenciais();

    expect(problema.variavel).toBe("R2_BUCKET");
    expect(problema.problema).toContain("minúsculo");
  });

  it("lista todos os problemas de uma vez, não só o primeiro", () => {
    // Quem copiou um campo errado costuma ter copiado os dois.
    definirValidas();
    process.env.R2_ACCESS_KEY_ID = "curto";
    process.env.R2_SECRET_ACCESS_KEY = "tambem-curto";

    const variaveis = conferirFormatoDasCredenciais().map((item) => item.variavel);

    expect(variaveis).toEqual(["R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY"]);
  });

  it("sem configuração não opina sobre formato", () => {
    expect(conferirFormatoDasCredenciais()).toEqual([]);
  });

  it("o erro de tamanho do SDK vira português, com os dois números", () => {
    const traduzido = traduzirErroDeArmazenamento(
      new Error("Credential access key has length 53, should be 32")
    );

    expect(traduzido).toContain("53");
    expect(traduzido).toContain("32");
    expect(traduzido).toContain("Access Key ID");
  });
});
