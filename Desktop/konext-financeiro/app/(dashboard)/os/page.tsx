import { DashboardOS } from "@/components/os/dashboard-os";
import { ordensMock, clientesMock } from "@/dados/mock-os";

export const metadata = {
  title: "Ordem de Serviço - Konext ERP",
  description: "Gerenciar ordens de serviço e manutenção",
};

export default function OSPage() {
  return (
    <div className="w-full h-full flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-900">
      {/* Header Section */}
      <div className="px-6 lg:px-8 py-6 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        <div className="max-w-7xl">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-50">
            Ordem de Serviço (OS)
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-2 text-sm">
            Gerenciar entradas, orçamentos e status de manutenção de equipamentos
          </p>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-6 lg:px-8 py-6">
          <div className="max-w-7xl mx-auto">
            <DashboardOS ordensServico={ordensMock} clientes={clientesMock} />
          </div>
        </div>
      </div>
    </div>
  );
}
