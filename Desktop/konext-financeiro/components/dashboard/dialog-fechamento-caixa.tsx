"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { BarChart3 } from "lucide-react";

interface DialogFechamentoCaixaProps {
  /** Conteúdo do relatório — renderizado no servidor e passado como children. */
  children: React.ReactNode;
}

/**
 * Wrapper client-side que encapsula o relatório de Fechamento de Caixa
 * dentro de um Dialog. O conteúdo (Server Component) é passado como children
 * para preservar o data-fetching no servidor (padrão App Router).
 */
export function DialogFechamentoCaixa({ children }: DialogFechamentoCaixaProps) {
  const [aberto, setAberto] = useState(false);

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <BarChart3 className="h-4 w-4 mr-2" />
          Fechamento de Caixa
        </Button>
      </DialogTrigger>

      {/* max-w-5xl garante espaço suficiente para o grid de 3 cartões */}
      <DialogContent className="max-w-5xl w-full max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-slate-900 dark:text-white">
            Fechamento de Caixa
          </DialogTitle>
        </DialogHeader>

        {/* Conteúdo do relatório injetado pelo Server Component pai */}
        <div className="mt-2">{children}</div>
      </DialogContent>
    </Dialog>
  );
}
