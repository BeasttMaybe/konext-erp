"use client";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import Link from "next/link";

export default function EntrarPage() {
  return (
    <div className="w-full max-w-md">
      <Card className="p-8">
        <div className="space-y-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-slate-900">Konext</h1>
            <p className="text-slate-600 text-sm mt-2">
              Faça login para acessar o ERP
            </p>
          </div>

          <form className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="senha">Senha</Label>
              <Input
                id="senha"
                type="password"
                placeholder="••••••••"
              />
            </div>

            <Button asChild className="w-full bg-blue-600 hover:bg-blue-700">
              <Link href="/">
                Entrar
              </Link>
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
}
