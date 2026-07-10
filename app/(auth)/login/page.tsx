"use client";

import { useActionState } from "react";
import { ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { login } from "@/app/actions/auth";

const estadoInicial = {
  erro: null as string | null,
};

export default function LoginPage() {
  const [estado, acaoLogin, carregandoLogin] = useActionState(login, estadoInicial);

  return (
    <Card className="w-full max-w-md p-8 bg-slate-900 border-slate-800 text-slate-100">
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center">
            <ShieldCheck className="h-6 w-6 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold">Konext ERP</h1>
          <p className="text-sm text-slate-400">Acesse com suas credenciais para entrar no sistema.</p>
        </div>

        <form action={acaoLogin} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-slate-200">E-mail</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="gabriel@konext.com.br"
              required
              autoComplete="email"
              className="bg-slate-950 border-slate-700 text-slate-100"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="senha" className="text-slate-200">Senha</Label>
            <Input
              id="senha"
              name="senha"
              type="password"
              placeholder="Digite sua senha"
              required
              autoComplete="current-password"
              className="bg-slate-950 border-slate-700 text-slate-100"
            />
          </div>

          {estado.erro && (
            <p className="text-sm text-red-400">{estado.erro}</p>
          )}

          <Button type="submit" className="w-full" disabled={carregandoLogin}>
            {carregandoLogin ? "Entrando..." : "Entrar"}
          </Button>
        </form>
      </div>
    </Card>
  );
}
