"use client";

import { Card } from "@/components/ui/card";
import { Avatar, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function PerfilPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Meu Perfil</h1>
        <p className="text-sm text-muted-foreground">
          Atualize seus dados de acesso e informações pessoais.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
        <Card className="border-border bg-card p-6">
          <div className="flex flex-col items-center text-center space-y-4">
            <Avatar className="h-24 w-24">
              <AvatarImage
                src="https://api.dicebear.com/7.x/avataaars/svg?seed=Gabriel%20Vieira"
                alt="Gabriel Vieira"
              />
            </Avatar>

            <div>
              <p className="text-lg font-semibold text-foreground">Gabriel Vieira</p>
              <p className="text-sm text-muted-foreground">gabriel@konext.com.br</p>
            </div>

            <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white">
              Administrador / Tech Lead
            </Badge>
          </div>
        </Card>

        <Card className="border-border bg-card p-6">
          <form className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="nomeCompleto">Nome Completo</Label>
                <Input id="nomeCompleto" defaultValue="Gabriel Vieira" placeholder="Informe seu nome completo" />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" type="email" defaultValue="gabriel@konext.com.br" placeholder="seu@email.com.br" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="senhaAtual">Senha Atual</Label>
                <Input id="senhaAtual" type="password" placeholder="Digite sua senha atual" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="novaSenha">Nova Senha</Label>
                <Input id="novaSenha" type="password" placeholder="Digite a nova senha" />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="confirmarNovaSenha">Confirmar Nova Senha</Label>
                <Input
                  id="confirmarNovaSenha"
                  type="password"
                  placeholder="Digite novamente a nova senha"
                />
              </div>
            </div>

            <div className="pt-2">
              <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">
                Atualizar Perfil
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
