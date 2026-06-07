import { obterConfiguracoes } from "@/app/actions/configuracoes";
import { FormConfiguracoes } from "./form-configuracoes";

export default async function ConfiguracoesPage() {
  const configuracoes = await obterConfiguracoes();

  return (
    <div className="w-full min-h-full bg-slate-50 dark:bg-slate-900 p-6">
      <div className="space-y-6 max-w-6xl">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Configurações do Sistema
          </h1>
          <p className="text-sm text-muted-foreground">
            Defina informações da empresa, regras operacionais e personalização visual.
          </p>
        </div>

        <FormConfiguracoes defaultValues={configuracoes} />
      </div>
    </div>
  );
}
