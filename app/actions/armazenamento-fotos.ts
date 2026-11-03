"use server";

import { exigirContextoTenant } from "@/lib/tenant/exigir-contexto-tenant";
import { exigirPermissao } from "@/lib/auth/permissoes";
import { ACOES_AUDITORIA, ENTIDADES_AUDITORIA } from "@/lib/auditoria-constantes";
import { contextoAuditoriaDoUsuario, registrarLogAuditoria } from "@/lib/auditoria";
import {
  conferirFormatoDasCredenciais,
  diagnosticarArmazenamento,
  lerConfiguracaoArmazenamento,
  type ProblemaDeFormato,
  type ResultadoDiagnostico,
} from "@/lib/fotos/armazenamento";

export type SituacaoArmazenamento = {
  configurado: boolean;
  /** Nomes das variáveis de ambiente que faltam. Vazio quando está tudo lá. */
  faltando: string[];
  /**
   * Bucket e conta, para a tela confirmar que está apontando pro lugar que o
   * dono espera. Nome de bucket e Account ID não são segredo — as chaves são, e
   * essas nunca saem daqui.
   */
  bucket: string | null;
  accountId: string | null;
  /**
   * Valores com formato impossível — tamanho ou alfabeto errados. Detectado
   * sem falar com a Cloudflare, e exibido antes de o dono clicar em testar.
   * Nunca inclui o valor de nada: só tamanho e formato.
   */
  problemasDeFormato: ProblemaDeFormato[];
};

export async function obterSituacaoArmazenamento(): Promise<SituacaoArmazenamento> {
  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "configuracoes.sistema");

  const resultado = lerConfiguracaoArmazenamento();

  if (!resultado.ok) {
    return {
      configurado: false,
      faltando: resultado.faltando,
      bucket: null,
      accountId: null,
      problemasDeFormato: [],
    };
  }

  return {
    configurado: true,
    faltando: [],
    bucket: resultado.configuracao.bucket,
    accountId: resultado.configuracao.accountId,
    problemasDeFormato: conferirFormatoDasCredenciais(),
  };
}

/**
 * Roda o diagnóstico: grava um arquivo de teste, lê de volta e apaga.
 *
 * Exige `configuracoes.sistema` porque fala com o armazenamento da empresa, e
 * fica registrado em auditoria — não por ser perigoso (o arquivo é de três
 * linhas e sai do bucket em seguida), mas porque um diagnóstico que começa a
 * falhar é informação útil, e saber quando passou pela última vez responde
 * "quebrou agora ou nunca funcionou?".
 */
export async function testarArmazenamento(): Promise<ResultadoDiagnostico> {
  const contexto = await exigirContextoTenant();
  exigirPermissao(contexto, "configuracoes.sistema");

  const resultado = await diagnosticarArmazenamento();

  await registrarLogAuditoria(
    contexto.prisma,
    contextoAuditoriaDoUsuario(
      contexto.usuarioOperacional,
      "app/actions/armazenamento-fotos.ts:testarArmazenamento"
    ),
    {
      acao: ACOES_AUDITORIA.TESTAR_ARMAZENAMENTO,
      entidade: ENTIDADES_AUDITORIA.SISTEMA,
      dadosDepois: {
        gravou: resultado.gravou,
        leu: resultado.leu,
        apagou: resultado.apagou,
        etapaQueFalhou: resultado.etapaQueFalhou,
        // A mensagem traduzida entra no log; ela nunca contém credencial.
        erro: resultado.erro,
      },
    }
  ).catch(() => {
    // O log é melhor-esforço: um diagnóstico que passou não deve virar erro na
    // tela porque a auditoria falhou.
  });

  return resultado;
}
