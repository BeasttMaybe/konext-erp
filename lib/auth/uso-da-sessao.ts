/**
 * De quanto em quanto tempo vale a pena gravar "esta sessao foi usada agora".
 *
 * `ultimoUsoEm` serve para a tela de usuarios mostrar o ultimo acesso de cada
 * pessoa. Ninguem le esse campo com precisao de segundo.
 *
 * Mas ele era gravado a CADA resolucao de sessao — e a sessao e resolvida em
 * todo layout, toda pagina e toda action. Abrir a tela inicial fazia cinco
 * escritas no banco central so para repetir, com milissegundos de diferenca,
 * a mesma informacao. Escrita e a operacao mais cara do banco e a unica que
 * disputa a linha com as outras requisicoes do mesmo usuario.
 *
 * Com a folga abaixo, a tela mostra o ultimo acesso com erro de no maximo
 * cinco minutos, e a sessao deixa de escrever em quase toda requisicao.
 */
export const INTERVALO_MINIMO_ENTRE_REGISTROS_DE_USO_MS = 5 * 60 * 1000;

export function precisaRegistrarUso(ultimoUsoEm: Date | null, agora: Date): boolean {
  if (ultimoUsoEm === null) return true;

  const decorrido = agora.getTime() - ultimoUsoEm.getTime();

  // `decorrido < 0` e relogio adiantado em outra instancia do servidor: nao
  // ha o que corrigir gravando de novo.
  return decorrido >= INTERVALO_MINIMO_ENTRE_REGISTROS_DE_USO_MS;
}
