import { obterConexaoZernio } from "@/app/actions/marketing";
import { PainelConexoes } from "@/components/marketing/painel-conexoes";

export const metadata = { title: "Conexões | Marketing | TechOS" };

export default async function ConexoesMarketingPage() {
  const conexao = await obterConexaoZernio();
  return (
    <div className="flex w-full flex-col gap-4 bg-kx-fundo p-4 pb-8 sm:p-5 lg:p-6">
      <PainelConexoes conexao={conexao} />
    </div>
  );
}
