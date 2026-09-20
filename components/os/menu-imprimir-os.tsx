"use client";

import { ChevronDown, Printer } from "lucide-react";
import type { ModeloImpressaoOS } from "@prisma/client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type PropsMenuImprimirOS = {
  osId: string;
  modeloPadrao: ModeloImpressaoOS;
};

const OPCOES_IMPRESSAO = [
  { modelo: "A4" as const, rotulo: "Folha A4", parametro: "a4" },
  { modelo: "TERMICA_80MM" as const, rotulo: "Térmica 80 mm", parametro: "termica" },
];

export function MenuImprimirOS({ osId, modeloPadrao }: PropsMenuImprimirOS) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="h-[42px]">
          <Printer className="h-4 w-4 mr-2" />
          Imprimir
          <ChevronDown className="h-3.5 w-3.5 ml-2" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {OPCOES_IMPRESSAO.map((opcao) => (
          <DropdownMenuItem key={opcao.modelo} asChild className="cursor-pointer gap-2">
            <a
              href={`/os/${osId}/imprimir?modelo=${opcao.parametro}&auto=1`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {opcao.rotulo}
              {opcao.modelo === modeloPadrao && (
                <span className="ml-auto text-[10px] uppercase tracking-wide text-muted-foreground">Padrão</span>
              )}
            </a>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
