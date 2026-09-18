"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Building2,
  FileText,
  Wrench,
  ShieldCheck,
  ShoppingCart,
  Wallet,
  Package,
  Users,
  Target,
  UserCog,
  Shield,
  Palette,
  type LucideIcon,
} from "lucide-react";
import type { ItemSecaoConfiguracoes, SecaoConfiguracoesId } from "./tipos";

const iconesPorSecao: Record<SecaoConfiguracoesId, LucideIcon> = {
  empresa: Building2,
  documentos: FileText,
  os: Wrench,
  garantias: ShieldCheck,
  "pdv-vendas": ShoppingCart,
  financeiro: Wallet,
  estoque: Package,
  crm: Users,
  metas: Target,
  usuarios: UserCog,
  auditoria: Shield,
  aparencia: Palette,
};

type PropsMenuConfiguracoes = {
  secoes: ItemSecaoConfiguracoes[];
  secaoAtiva: SecaoConfiguracoesId;
  onSelecionarSecao: (secao: SecaoConfiguracoesId) => void;
};

export function MenuConfiguracoes({ secoes, secaoAtiva, onSelecionarSecao }: PropsMenuConfiguracoes) {
  return (
    <aside className="rounded-xl border border-border bg-card/70 p-2 md:p-3">
      <div className="flex flex-col gap-1.5">
        {secoes.map((secao) => {
          const Icone = iconesPorSecao[secao.id];
          const ativo = secao.id === secaoAtiva;

          return (
            <Button
              key={secao.id}
              type="button"
              variant="ghost"
              onClick={() => onSelecionarSecao(secao.id)}
              className={cn(
                "justify-start h-auto px-3 py-2.5 w-full",
                ativo
                  ? "bg-emerald-600 text-white hover:bg-emerald-700 hover:text-white"
                  : "text-foreground/90 hover:bg-muted"
              )}
            >
              <span className="flex items-start gap-2.5 text-left">
                <Icone className="h-4 w-4 mt-0.5 shrink-0" />
                <span className="space-y-0.5">
                  <span className="flex items-center gap-1.5">
                    <span className="block text-sm font-medium leading-tight">{secao.rotulo}</span>
                    {secao.emPreparacao && (
                      <Badge
                        variant="outline"
                        className={cn(
                          "h-4 shrink-0 px-1.5 text-[10px] font-normal leading-none",
                          ativo ? "border-emerald-200 text-emerald-50" : "border-border text-muted-foreground"
                        )}
                      >
                        Em breve
                      </Badge>
                    )}
                  </span>
                  <span
                    className={cn(
                      "block text-xs leading-tight whitespace-normal",
                      ativo ? "text-emerald-50/90" : "text-muted-foreground"
                    )}
                  >
                    {secao.descricao}
                  </span>
                </span>
              </span>
            </Button>
          );
        })}
      </div>
    </aside>
  );
}
