import { ShieldAlert } from "lucide-react";

/**
 * Estado limpo para paginas cujo usuario logado nao tem a permissao
 * necessaria. Usado por /financeiro/**, /configuracoes e paineis de
 * auditoria — em vez de deixar a pagina lancar (Fase 1B, Parte 1).
 */
export function AcessoNegado({
  titulo = "Acesso não permitido",
  descricao = "Seu perfil não tem permissão para ver esta página. Fale com um administrador se precisar de acesso.",
}: {
  titulo?: string;
  descricao?: string;
}) {
  return (
    <div className="flex min-h-[50vh] w-full flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <ShieldAlert className="h-6 w-6 text-muted-foreground" aria-hidden />
      </div>
      <h1 className="text-lg font-semibold text-foreground">{titulo}</h1>
      <p className="max-w-md text-sm text-muted-foreground">{descricao}</p>
    </div>
  );
}
