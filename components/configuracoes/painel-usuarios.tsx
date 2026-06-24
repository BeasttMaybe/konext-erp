import { PainelPlaceholder } from "./painel-placeholder";

export function PainelUsuarios() {
  return (
    <PainelPlaceholder
      titulo="Usuários e Permissões"
      descricao="Organize os acessos e papéis dos usuários do sistema."
      itens={[
        "Perfis de acesso por função",
        "Políticas de permissões por módulo",
        "Padrões de ativação e bloqueio",
        "Visibilidade de recursos administrativos",
      ]}
    />
  );
}
