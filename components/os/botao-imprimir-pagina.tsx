"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function BotaoImprimirPagina() {
  return (
    <Button type="button" onClick={() => window.print()}>
      <Printer className="h-4 w-4 mr-2" />
      Imprimir agora
    </Button>
  );
}