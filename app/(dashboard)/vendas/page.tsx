import Link from "next/link";
import {
  ArrowRight,
  ClipboardList,
  FileBadge2,
  FileSignature,
  ReceiptText,
  RotateCcw,
  ShoppingBag,
  Truck,
  Wrench,
} from "lucide-react";
import { Card } from "@/components/ui/card";

type HubLink = {
  title: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  accentClass: string;
};

type HubSection = {
  title: string;
  description: string;
  links: HubLink[];
};

const hubSections: HubSection[] = [
  {
    title: "Gestão",
    description: "Fluxos principais da operação comercial e do faturamento.",
    links: [
      {
        title: "Pedidos de Venda",
        description: "Cadastre pedidos, acompanhe negociações e organize o pipeline de saída.",
        href: "/vendas/pedidos/novo",
        icon: ClipboardList,
        accentClass: "from-cyan-500/20 via-slate-900/10 to-transparent text-cyan-300",
      },
      {
        title: "Notas Fiscais de Saída",
        description: "Centralize emissões, conferências fiscais e histórico documental.",
        href: "#",
        icon: FileBadge2,
        accentClass: "from-violet-500/20 via-slate-900/10 to-transparent text-violet-300",
      },
      {
        title: "Frente de Caixa",
        description: "Acesse operações rápidas de atendimento e fechamento comercial.",
        href: "/pdv",
        icon: ShoppingBag,
        accentClass: "from-emerald-500/20 via-slate-900/10 to-transparent text-emerald-300",
      },
    ],
  },
  {
    title: "Logística",
    description: "Coordene entregas, transporte e retornos com visão operacional.",
    links: [
      {
        title: "Gestão de Frete",
        description: "Planeje transportadoras, custos e acompanhamento das expedições.",
        href: "#",
        icon: Truck,
        accentClass: "from-amber-500/20 via-slate-900/10 to-transparent text-amber-300",
      },
      {
        title: "Logística Reversa",
        description: "Gerencie devoluções, coletas e tratativas de retorno ao estoque.",
        href: "#",
        icon: RotateCcw,
        accentClass: "from-rose-500/20 via-slate-900/10 to-transparent text-rose-300",
      },
    ],
  },
  {
    title: "Serviços",
    description: "Conecte contratos, ordens e documentos de prestação de serviço.",
    links: [
      {
        title: "Contratos",
        description: "Visualize contratos ativos, aditivos e renovações comerciais.",
        href: "#",
        icon: FileSignature,
        accentClass: "from-sky-500/20 via-slate-900/10 to-transparent text-sky-300",
      },
      {
        title: "Ordens de Serviço",
        description: "Acompanhe atendimentos, aprovações e entregas vinculadas à venda.",
        href: "/os",
        icon: Wrench,
        accentClass: "from-fuchsia-500/20 via-slate-900/10 to-transparent text-fuchsia-300",
      },
      {
        title: "Notas de Serviço",
        description: "Organize emissões de documentos fiscais para serviços prestados.",
        href: "#",
        icon: ReceiptText,
        accentClass: "from-indigo-500/20 via-slate-900/10 to-transparent text-indigo-300",
      },
    ],
  },
];

export const metadata = {
  title: "Vendas - Konext ERP",
  description: "Hub estático do ecossistema de vendas.",
};

export default function SalesHubPage() {
  return (
    <div className="w-full flex flex-col bg-transparent">
      <div className="border-b border-white/10 bg-slate-950/55 px-6 py-6 backdrop-blur-xl lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="inline-flex items-center rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.24em] text-cyan-200">
            Ecossistema Comercial
          </div>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-50 lg:text-4xl">
            Hub de Vendas
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300/80 lg:text-base">
            Navegue pelos blocos estratégicos da operação comercial com uma visão clara entre gestão, logística e serviços.
          </p>
        </div>
      </div>

      <div className="px-6 py-6 lg:px-8">
        <div className="mx-auto max-w-7xl space-y-8">
          {hubSections.map((section) => (
            <section key={section.title} className="space-y-4">
              <div className="flex flex-col gap-2">
                <h2 className="text-xl font-semibold text-slate-100">{section.title}</h2>
                <p className="text-sm text-slate-400">{section.description}</p>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {section.links.map((link) => {
                  const Icon = link.icon;

                  return (
                    <Link key={link.title} href={link.href} className="group block">
                      <Card className="relative h-full overflow-hidden rounded-3xl border border-white/10 bg-slate-950/55 p-6 shadow-[0_20px_60px_-30px_rgba(15,23,42,0.95)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-cyan-300/30 hover:bg-slate-900/75 hover:shadow-[0_24px_70px_-26px_rgba(34,211,238,0.28)]">
                        <div className={`absolute inset-0 bg-gradient-to-br ${link.accentClass} opacity-80 transition-opacity duration-300 group-hover:opacity-100`} />
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.12),transparent_42%)]" />

                        <div className="relative flex h-full flex-col justify-between gap-8">
                          <div className="space-y-4">
                            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-100 shadow-inner shadow-white/5">
                              <Icon className="h-5 w-5" />
                            </div>

                            <div className="space-y-2">
                              <h3 className="text-lg font-semibold text-slate-50">{link.title}</h3>
                              <p className="text-sm leading-6 text-slate-300/75">{link.description}</p>
                            </div>
                          </div>

                          <div className="flex items-center justify-between border-t border-white/10 pt-4 text-sm font-medium text-slate-200/90">
                            <span>Acessar módulo</span>
                            <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                          </div>
                        </div>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}