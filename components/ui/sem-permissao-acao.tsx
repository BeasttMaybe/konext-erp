/**
 * Linha curta para substituir uma coluna/área de ações que ficaria vazia ou
 * confusa quando o usuário não tem nenhuma das permissões daquela ação
 * (Fase 1B-UI, Parte 1). Não é um bloqueio de tela — só evita clique morto
 * ou espaço em branco sem explicação onde normalmente haveria um botão.
 */
export function SemPermissaoAcao() {
  return (
    <span className="text-xs text-muted-foreground">
      Você não tem permissão para esta ação. Fale com o administrador da loja.
    </span>
  );
}
