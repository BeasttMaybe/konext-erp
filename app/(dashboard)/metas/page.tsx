import { PaginaMetas } from"@/components/metas/pagina-metas";

export const metadata = {
  title:"Metas - Konext ERP",
  description:"Acompanhe objetivos financeiros, operacionais e estratégicos da empresa.",
};

export default function MetasPage() {
  return (
    <div className="w-full flex flex-col bg-transparent">
      <div className="border-b border-kx-painel-borda/70 bg-kx-painel/75 px-6 py-6 backdrop-blur-sm/70/50 lg:px-8">
        <div className="max-w-7xl">
          <h1 className="text-3xl font-bold text-kx-texto">Metas</h1>
          <p className="text-kx-texto-2 mt-2 text-sm">
            Acompanhe objetivos financeiros, operacionais e estratégicos da empresa.
          </p>
        </div>
      </div>

      <div className="px-6 lg:px-8 py-6 pb-10">
        <div className="max-w-7xl mx-auto">
          <PaginaMetas />
        </div>
      </div>
    </div>
  );
}
