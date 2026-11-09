"use client";

import { ChevronDown, Printer } from "lucide-react";
import type { ModeloImpressaoOS } from "@prisma/client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type PropsMenuImprimirOS = {
  osId: string;
  modeloPadrao: ModeloImpressaoOS;
  /**
   * A OS já tem termo de garantia emitido?
   *
   * O termo nasce na finalização, e a impressão dele acontece sozinha
   * naquele momento. Este item existe para a SEGUNDA vez: cliente que
   * perdeu o papel, ou que volta pedindo cópia. Sem ele, reimprimir exigia
   * digitar a URL na mão.
   *
   * Só aparece quando o termo existe — oferecer a impressão de um documento
   * que ainda não foi emitido leva a uma tela que só sabe dizer "ainda não".
   */
  possuiTermoGarantia?: boolean;
};

const OPCOES_IMPRESSAO = [
  { modelo: "A4" as const, rotulo: "Folha A4", parametro: "a4" },
  { modelo: "TERMICA_80MM" as const, rotulo: "Térmica 80 mm", parametro: "termica" },
];

export function MenuImprimirOS({
  osId,
  modeloPadrao,
  possuiTermoGarantia = false,
}: PropsMenuImprimirOS) {
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

        {possuiTermoGarantia && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild className="cursor-pointer gap-2">
              <a
                href={`/os/${osId}/garantia?auto=1`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Termo de garantia
              </a>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
