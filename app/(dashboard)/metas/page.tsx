import { PaginaMetas } from "@/components/metas/pagina-metas";

export const metadata = {
  title: "Metas - Konext ERP",
  description: "Acompanhe objetivos financeiros, operacionais e estratégicos da empresa.",
};

export default function MetasPage() {
  return (
    <div className="w-full flex flex-col bg-transparent">
      <div className="border-b border-slate-200/70 bg-white/75 px-6 py-6 backdrop-blur-sm dark:border-slate-700/70 dark:bg-slate-900/50 lg:px-8">
        <div className="max-w-7xl">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-50">Metas</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-2 text-sm">
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
