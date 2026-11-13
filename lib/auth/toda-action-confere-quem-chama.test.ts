import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * GUARDA: Server Action e endpoint publico.
 *
 * Toda funcao async exportada de um arquivo "use server" pode ser chamada por
 * qualquer pessoa na internet, com os argumentos que ela quiser — o Next gera
 * uma rota para cada uma. O compilador nao sabe disso e o lint tambem nao:
 * uma action sem checagem de sessao compila, passa em todo teste de dominio e
 * funciona perfeitamente na tela.
 *
 * A auditoria de 11/11/2026 achou quatro casos, todos do mesmo formato — um
 * auxiliar escrito para ser chamado por outra action, exportado de um arquivo
 * "use server" so para poder ser importado:
 *
 *   - `lib/auth/sessao-central.ts` inteiro era "use server": `criarSessaoCentral`
 *     criava sessao para qualquer id de usuario, sem senha.
 *   - `listarUsuariosComAcessoAdmin(empresaId)` listava os usuarios de qualquer
 *     empresa.
 *   - `consultarCnpjReceita` era um repetidor aberto para um servico externo.
 *   - `garantirTermoGarantiaPorOS` e `sincronizarMetasAutomaticasDoTenant`
 *     recebiam o cliente do banco como argumento.
 *
 * Este teste le o codigo-fonte e falha se aparecer um quinto.
 */

const RAIZ = process.cwd();

/** Chamadas que provam que a funcao confere QUEM esta chamando. */
const CONFERE_QUEM_CHAMA =
  /\b(exigirContextoTenant|exigirSessaoCentral|exigirChamadaInterna)\s*\(/;

/**
 * Actions que, de proposito, atendem quem nao tem sessao. Cada uma precisa
 * dizer o que a protege no lugar da sessao.
 */
const SEM_SESSAO_DE_PROPOSITO: Record<string, string> = {
  "auth.ts:login": "e a porta de entrada: confere e-mail e senha",
  "auth.ts:logout": "so revoga a sessao do proprio cookie; sem cookie nao faz nada",
  "recuperar-senha.ts:pedirLinkDeRecuperacao": "so manda link para o e-mail da propria conta; resposta igual com ou sem conta",
  "recuperar-senha.ts:redefinirSenhaPeloLink": "autorizada pelo token do link (hash, 30 min, uso unico)",
  "foto-pelo-celular.ts:abrirLinkDeFoto": "autorizada pelo segredo do link (hash, validade, revogacao)",
  "foto-pelo-celular.ts:enviarFotoPeloCelular": "autorizada pelo segredo do link (hash, validade, revogacao)",
};

type Funcao = { nome: string; exportada: boolean; corpo: string };

/**
 * Divide o arquivo nas declaracoes de topo. Uma declaracao vai da sua linha
 * ate a proxima linha que comeca, na coluna zero, outra declaracao — o que
 * dispensa contar chaves e nao se perde com tipo de retorno em objeto.
 */
function funcoesDoArquivo(fonte: string): Funcao[] {
  const linhas = fonte.split("\n");
  const inicioDeDeclaracao = /^(export\s+)?(async\s+function|function|const|let|type|interface|class|enum)\b/;
  const cabecalhoDeFuncao = /^(export\s+)?async\s+function\s+(\w+)/;

  const funcoes: Funcao[] = [];
  let atual: { nome: string; exportada: boolean; linhas: string[] } | null = null;

  for (const linha of linhas) {
    if (inicioDeDeclaracao.test(linha)) {
      if (atual) funcoes.push({ nome: atual.nome, exportada: atual.exportada, corpo: atual.linhas.join("\n") });
      const cabecalho = cabecalhoDeFuncao.exec(linha);
      atual = cabecalho ? { nome: cabecalho[2], exportada: Boolean(cabecalho[1]), linhas: [linha] } : null;
      continue;
    }
    atual?.linhas.push(linha);
  }
  if (atual) funcoes.push({ nome: atual.nome, exportada: atual.exportada, corpo: atual.linhas.join("\n") });

  return funcoes;
}

/**
 * Uma funcao "confere" se chama a checagem ou se chama outra funcao do mesmo
 * arquivo que confere. Fecho transitivo, para aceitar a action fina que so
 * delega a uma irma.
 */
function nomesQueConferem(funcoes: Funcao[]): Set<string> {
  const conferem = new Set(funcoes.filter((f) => CONFERE_QUEM_CHAMA.test(f.corpo)).map((f) => f.nome));

  let mudou = true;
  while (mudou) {
    mudou = false;
    for (const funcao of funcoes) {
      if (conferem.has(funcao.nome)) continue;
      const delega = [...conferem].some((nome) => new RegExp(`\\b${nome}\\s*\\(`).test(funcao.corpo));
      if (delega) {
        conferem.add(funcao.nome);
        mudou = true;
      }
    }
  }

  return conferem;
}

function ehModuloDeActions(fonte: string): boolean {
  return /^\s*["']use server["'];?\s*$/m.test(fonte.split("\n").slice(0, 5).join("\n"));
}

function arquivosDe(pasta: string, extensoes: RegExp): string[] {
  const achados: string[] = [];
  for (const nome of readdirSync(pasta)) {
    if (nome === "node_modules" || nome.startsWith(".")) continue;
    const caminho = join(pasta, nome);
    if (statSync(caminho).isDirectory()) achados.push(...arquivosDe(caminho, extensoes));
    else if (extensoes.test(nome)) achados.push(caminho);
  }
  return achados;
}

describe("toda Server Action confere quem chama", () => {
  const pasta = join(RAIZ, "app/actions");
  const arquivos = readdirSync(pasta).filter((nome) => nome.endsWith(".ts") && !nome.endsWith(".test.ts"));

  const exportadas = arquivos.flatMap((arquivo) => {
    const fonte = readFileSync(join(pasta, arquivo), "utf8");
    if (!ehModuloDeActions(fonte)) return [];
    const funcoes = funcoesDoArquivo(fonte);
    const conferem = nomesQueConferem(funcoes);
    return funcoes
      .filter((funcao) => funcao.exportada)
      .map((funcao) => ({ chave: `${arquivo}:${funcao.nome}`, confere: conferem.has(funcao.nome) }));
  });

  it("o leitor enxerga as actions (senao o teste passaria vazio)", () => {
    expect(exportadas.length).toBeGreaterThan(150);
    expect(exportadas.some((action) => action.chave === "auth.ts:alterarMinhaSenha")).toBe(true);
  });

  it("nenhuma action exportada deixa de conferir sessao, fora as declaradas", () => {
    const abertas = exportadas
      .filter((action) => !action.confere && !(action.chave in SEM_SESSAO_DE_PROPOSITO))
      .map((action) => action.chave);

    expect(abertas).toEqual([]);
  });

  it("a lista de excecoes nao guarda nome que ja nao existe", () => {
    const existentes = new Set(exportadas.map((action) => action.chave));
    const sobrando = Object.keys(SEM_SESSAO_DE_PROPOSITO).filter((chave) => !existentes.has(chave));

    expect(sobrando).toEqual([]);
  });

  it("as excecoes realmente nao conferem sessao (senao nao precisam estar na lista)", () => {
    const desnecessarias = exportadas
      .filter((action) => action.confere && action.chave in SEM_SESSAO_DE_PROPOSITO)
      .map((action) => action.chave);

    expect(desnecessarias).toEqual([]);
  });
});

describe('"use server" so existe em app/actions', () => {
  /**
   * Um modulo de biblioteca com a diretiva expoe TUDO o que exporta. Em
   * `lib/` e `components/` os modulos sao auxiliares: confiam no chamador e
   * nao conferem nada. Marque com `import "server-only"` — que faz o
   * contrario, quebrando o build se o modulo for parar no navegador.
   */
  it("nenhum arquivo de lib/, components/ ou contextos/ tem a diretiva", () => {
    const comDiretiva = ["lib", "components", "contextos", "store"]
      .flatMap((pasta) => arquivosDe(join(RAIZ, pasta), /\.tsx?$/))
      .filter((caminho) => !caminho.endsWith(".test.ts") && !caminho.endsWith(".test.tsx"))
      .filter((caminho) => ehModuloDeActions(readFileSync(caminho, "utf8")))
      .map((caminho) => caminho.replace(`${RAIZ}/`, ""));

    expect(comDiretiva).toEqual([]);
  });

  it("o modulo de sessao esta marcado como exclusivo do servidor", () => {
    const fonte = readFileSync(join(RAIZ, "lib/auth/sessao-central.ts"), "utf8");

    expect(fonte).toMatch(/^import "server-only";$/m);
  });
});
