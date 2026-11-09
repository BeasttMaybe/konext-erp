"use server";

import { revalidatePath } from "next/cache";

import { contextoAuditoriaDoUsuario, registrarLogAuditoria } from "@/lib/auditoria";
import { ACOES_AUDITORIA, ENTIDADES_AUDITORIA } from "@/lib/auditoria-constantes";
import { exigirPermissao } from "@/lib/auth/permissoes";
import {
  blingEstaConfigurado,
  chamarBling,
  ErroDoBling,
  esperarPelaVazao,
  montarUrlDeRedirecionamento,
} from "@/lib/bling/api";
import { lerPaginaDeNotas } from "@/lib/dominio/bling/nota-de-saida";
import { desconectar, lerConexao, obterAccessTokenValido } from "@/lib/bling/conexao";
import { paraMensagemSegura } from "@/lib/erros";
import { exigirContextoTenant } from "@/lib/tenant/exigir-contexto-tenant";
import { urlBaseDaRequisicao } from "@/lib/url-da-requisicao";

/**
 * A conexão da loja com o Bling, do lado da tela.
 *
 * O desenho é o que o dono escolheu: ele continua emitindo no Bling, e a
 * Konext só LÊ. Nenhuma função aqui escreve no Bling, e os escopos pedidos no
 * cadastro do aplicativo também não permitem.
 */

export type EstadoDaIntegracaoBling = {
  /** `BLING_CLIENT_ID`/`SECRET` existem no ambiente? Sem isso nada funciona. */
  configuradoNoAmbiente: boolean;
  conectado: boolean;
  conectadoEm: string | null;
  ultimaSincronizacaoEm: string | null;
  ultimoErro: string | null;
  /** Para o dono conferir contra o que cadastrou no aplicativo do Bling. */
  urlDeRedirecionamento: string;
};

export async function obterEstadoDaIntegracaoBling(): Promise<EstadoDaIntegracaoBling> {
  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "configuracoes.sistema");

  const urlBase = await urlBaseDaRequisicao();
  const conexao = await lerConexao(contexto.prisma);

  // Uma conexão com `accessToken` vazio é a linha provisória que a rota de
  // conectar cria só para guardar o nonce enquanto o dono está no Bling. Ela
  // não é uma conexão; dizer que é faria a tela mentir para quem desistiu no
  // meio do caminho.
  const conectado = Boolean(conexao && conexao.accessToken !== "");

  return {
    configuradoNoAmbiente: blingEstaConfigurado(),
    conectado,
    conectadoEm: conectado ? (conexao?.conectadoEm.toISOString() ?? null) : null,
    ultimaSincronizacaoEm: conexao?.ultimaSincronizacaoEm?.toISOString() ?? null,
    ultimoErro: conexao?.ultimoErro ?? null,
    urlDeRedirecionamento: urlBase ? montarUrlDeRedirecionamento(urlBase) : "",
  };
}

export type ResultadoBling = { sucesso: boolean; mensagem: string };

export async function desconectarBling(): Promise<ResultadoBling> {
  try {
    const contexto = await exigirContextoTenant();
    exigirPermissao(contexto, "configuracoes.sistema");

    await contexto.prisma.$transaction(async (tx) => {
      await registrarLogAuditoria(
        tx,
        contextoAuditoriaDoUsuario(
          contexto.usuarioOperacional,
          "app/actions/bling.ts:desconectarBling"
        ),
        {
          acao: ACOES_AUDITORIA.DESCONECTAR_BLING,
          entidade: ENTIDADES_AUDITORIA.CONFIGURACAO,
          entidadeId: contexto.tenantId,
          dadosDepois: { conectado: false },
        }
      );
    });

    await desconectar(contexto.prisma);
    revalidatePath("/configuracoes");

    return {
      sucesso: true,
      mensagem: "Desconectado. As notas já importadas continuam no Konext.",
    };
  } catch (erro) {
    return { sucesso: false, mensagem: paraMensagemSegura(erro) };
  }
}

export type AmostraDoBling =
  | { sucesso: true; recurso: string; amostra: string }
  | { sucesso: false; mensagem: string; exigeReconexao: boolean };

/**
 * Busca UM registro e devolve o JSON cru.
 *
 * Isto existe por uma limitação honesta: o ambiente onde este código é escrito
 * não alcança a API do Bling, então a forma exata das respostas — nomes de
 * campos, onde mora o número da nota, como vem a data — não pôde ser
 * verificada antes de escrever o importador. Adivinhar nomes de campo e
 * descobrir o erro depois, com dados do dono já importados torto, seria pior.
 *
 * Com um registro real em mãos, o importador é escrito uma vez e certo. Depois
 * que ele existir, esta função continua útil como diagnóstico: quando o Bling
 * mudar alguma coisa, ela mostra O QUE mudou, em vez de só "deu erro".
 *
 * Só traz 1 registro e corta o texto: é diagnóstico, não exportação de dados.
 */
export async function espiarRespostaDoBling(
  recurso: "nfe" | "contas" | "nfe-detalhe"
): Promise<AmostraDoBling> {
  try {
    const contexto = await exigirContextoTenant();
    exigirPermissao(contexto, "configuracoes.sistema");

    const accessToken = await obterAccessTokenValido(contexto.prisma);

    // O detalhe precisa de um id, e o id vem da listagem. Duas chamadas, com
    // a pausa da vazão entre elas: o Bling aceita 3 por segundo.
    if (recurso === "nfe-detalhe") {
      const lista = await chamarBling({
        accessToken,
        caminho: "/nfe",
        parametros: { limite: 1, pagina: 1 },
      });

      const primeira = lerPaginaDeNotas(lista)[0];
      if (!primeira) {
        return { sucesso: false, mensagem: "Nenhuma nota de saída encontrada no Bling.", exigeReconexao: false };
      }

      await esperarPelaVazao();

      const detalhe = await chamarBling({ accessToken, caminho: `/nfe/${primeira.blingId}` });

      return {
        sucesso: true,
        recurso: `/nfe/${primeira.blingId}`,
        amostra: JSON.stringify(detalhe, null, 2).slice(0, 6000),
      };
    }

    const caminho = recurso === "nfe" ? "/nfe" : "/contas/receber";
    const resposta = await chamarBling({
      accessToken,
      caminho,
      parametros: { limite: 1, pagina: 1 },
    });

    return {
      sucesso: true,
      recurso: caminho,
      amostra: JSON.stringify(resposta, null, 2).slice(0, 4000),
    };
  } catch (erro) {
    if (erro instanceof ErroDoBling) {
      return { sucesso: false, mensagem: erro.message, exigeReconexao: erro.exigeReconexao };
    }

    return { sucesso: false, mensagem: paraMensagemSegura(erro), exigeReconexao: false };
  }
}
