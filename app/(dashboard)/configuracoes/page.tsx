import { obterConfiguracoes } from "@/app/actions/configuracoes";
import { LayoutConfiguracoes } from "@/components/configuracoes/layout-configuracoes";

export default async function ConfiguracoesPage() {
  const configuracoes = await obterConfiguracoes();

  return (
    <div className="w-full min-h-full bg-slate-50 dark:bg-slate-900 p-6">
      <div className="space-y-6 max-w-7xl">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Configurações do Sistema
          </h1>
          <p className="text-sm text-muted-foreground">
            Gerencie dados da empresa, documentos, regras operacionais e preferências gerais do Konext ERP.
          </p>
        </div>

        <LayoutConfiguracoes defaultValues={configuracoes} />
      </div>
    </div>
  );
}
