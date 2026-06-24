"use client";

import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

export function BotaoImprimirGarantia() {
  return (
    <Button onClick={() => window.print()}>
      <Printer className="w-4 h-4 mr-2" />
      Imprimir termo de garantia
    </Button>
  );
}
