"use client";

import { Moon, Sun } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useTheme } from "@/components/provedores/provedor-tema";
import { SecaoConfiguracoes } from "./secao-configuracoes";

export function PainelAparencia() {
  const { theme, setTheme } = useTheme();

  return (
    <SecaoConfiguracoes
      titulo="Aparência"
      descricao="Personalize tema, identidade visual e preferências da interface."
    >
      <div className="grid gap-3 md:grid-cols-2 max-w-2xl">
        <Button
          type="button"
          variant="outline"
          onClick={() => setTheme("light")}
          className="h-auto justify-start p-4"
        >
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <Sun className="h-4 w-4" />
              <span className="font-medium">Modo claro</span>
            </div>
            {theme === "light" && <Badge>Ativo</Badge>}
          </div>
        </Button>

        <Button
          type="button"
          variant="outline"
          onClick={() => setTheme("dark")}
          className="h-auto justify-start p-4"
        >
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <Moon className="h-4 w-4" />
              <span className="font-medium">Modo escuro</span>
            </div>
            {theme === "dark" && <Badge>Ativo</Badge>}
          </div>
        </Button>
      </div>

      <Card className="border-border bg-background p-4">
        <p className="text-sm font-medium text-foreground">Identidade visual</p>
        <p className="text-xs text-muted-foreground mt-1">
          Nesta etapa, o controle de tema permanece ativo e a evolução de branding será concluída nas próximas fases.
        </p>
      </Card>
    </SecaoConfiguracoes>
  );
}
