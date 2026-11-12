/**
 * A mensagem que a pessoa ve quando a camera nao abre — em portugues, e
 * dizendo O QUE FAZER, nao o nome tecnico do erro.
 *
 * No iPhone o caso mais comum e a permissao negada: o Safari pergunta uma
 * vez, e um "Nao permitir" dado sem querer bloqueia ate a pessoa ir nos
 * Ajustes. Sem dizer onde, ela fica achando que o recurso nao funciona.
 */
export function mensagemDeErroDaCamera(erro: unknown): string {
  const nome = erro instanceof Error ? erro.name : "";

  switch (nome) {
    case "NotAllowedError":
    case "SecurityError":
      return "O acesso à câmera foi negado. No iPhone: Ajustes → Safari → Câmera → Permitir (ou, com o app instalado, Ajustes → Konext → Câmera). Depois, abra o leitor de novo.";
    case "NotFoundError":
    case "OverconstrainedError":
      return "Nenhuma câmera foi encontrada neste aparelho.";
    case "NotReadableError":
    case "AbortError":
      return "A câmera está sendo usada por outro app. Feche-o e tente de novo.";
    case "ContextoInseguro":
      return "A câmera só funciona com o sistema aberto pelo endereço seguro (https).";
    default:
      return "Não foi possível abrir a câmera. Feche o leitor e tente de novo.";
  }
}
