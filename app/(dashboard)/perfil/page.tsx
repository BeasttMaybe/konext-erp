"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  atualizarLogoEmpresa,
  atualizarPerfil,
  obterDadosPerfilConfiguracao,
} from "@/app/actions/configuracoes";
import { alterarMinhaSenha } from "@/app/actions/auth";
import { useTemPermissao } from "@/contextos/contexto-permissoes";

export default function PerfilPage() {
  const podeEditarLogoEmpresa = useTemPermissao("configuracoes.empresa");
  const [nomeCompleto, setNomeCompleto] = useState("");
  const [email, setEmail] = useState("");
  const [fotoPerfilUrl, setFotoPerfilUrl] = useState("");
  const [logoEmpresaUrl, setLogoEmpresaUrl] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmacaoSenha, setConfirmacaoSenha] = useState("");
  const [alterandoSenha, setAlterandoSenha] = useState(false);

  useEffect(() => {
    let ativo = true;

    const carregarDados = async () => {
      try {
        setCarregando(true);
        const dados = await obterDadosPerfilConfiguracao();
        if (!ativo) return;

        setNomeCompleto(dados.usuario?.nome ?? "");
        setEmail(dados.usuario?.email ?? "");
        setFotoPerfilUrl(dados.usuario?.fotoPerfilUrl ?? "");
        setLogoEmpresaUrl(dados.configuracao?.logoUrl ?? "");
      } catch {
        if (!ativo) return;
        toast.error("Nao foi possivel carregar os dados do perfil.");
      } finally {
        if (!ativo) return;
        setCarregando(false);
      }
    };

    carregarDados();

    return () => {
      ativo = false;
    };
  }, []);

  const iniciais = useMemo(() => {
    const partes = nomeCompleto.trim().split(/\s+/).filter(Boolean);
    if (partes.length === 0) return "KP";
    if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
    return `${partes[0][0]}${partes[partes.length - 1][0]}`.toUpperCase();
  }, [nomeCompleto]);

  const onSalvar = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      setSalvando(true);
      const resultadoPerfil = await atualizarPerfil({
        nome: nomeCompleto,
        email,
        fotoPerfilUrl,
      });

      if (!resultadoPerfil.sucesso) {
        toast.error(resultadoPerfil.erro);
        return;
      }

      // A logo da empresa exige configuracoes.empresa — campo nem aparece na
      // tela para quem nao tem a permissao, entao nem tentamos salvar.
      if (podeEditarLogoEmpresa) {
        const resultadoLogo = await atualizarLogoEmpresa(logoEmpresaUrl);

        if (!resultadoLogo.sucesso) {
          toast.error(resultadoLogo.erro);
          return;
        }
      }

      toast.success("Alteracoes salvas com sucesso.");
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : "Nao foi possivel salvar as alteracoes.";
      toast.error(mensagem);
    } finally {
      setSalvando(false);
    }
  };

  const onAlterarSenha = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (novaSenha !== confirmacaoSenha) {
      toast.error("A confirmação não confere com a nova senha.");
      return;
    }

    try {
      setAlterandoSenha(true);
      const resultado = await alterarMinhaSenha({ senhaAtual, novaSenha, confirmacao: confirmacaoSenha });

      if (!resultado.sucesso) {
        toast.error(resultado.erro);
        return;
      }

      toast.success("Senha alterada com sucesso. Suas outras sessões foram encerradas.");
      setSenhaAtual("");
      setNovaSenha("");
      setConfirmacaoSenha("");
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : "Não foi possível alterar a senha.";
      toast.error(mensagem);
    } finally {
      setAlterandoSenha(false);
    }
  };

  return (
    <div className= "space-y-6">
      <div className= "space-y-2">
        <h1 className= "text-3xl font-bold tracking-tight text-foreground">Meu Perfil</h1>
        <p className= "text-sm text-muted-foreground">
          Atualize seus dados de acesso e informações pessoais.
        </p>
      </div>

      <div className= "grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
        <Card className= "border-border bg-card p-6">
          <div className= "flex flex-col items-center text-center space-y-4">
            <Avatar className= "h-24 w-24">
              <AvatarImage
                src={fotoPerfilUrl || undefined}
                alt={nomeCompleto || "Usuario"}
              />
              <AvatarFallback>{iniciais}</AvatarFallback>
            </Avatar>

            <div>
              <p className= "text-lg font-semibold text-foreground">{nomeCompleto || "Usuario Konext"}</p>
              <p className= "text-sm text-muted-foreground">{email || "usuario@konext.local"}</p>
            </div>

            <Badge className= "bg-kx-sucesso hover:bg-kx-sucesso text-primary-foreground">
              Perfil de Usuario
            </Badge>
          </div>
        </Card>

        <Card className= "border-border bg-card p-6">
          <form className= "space-y-4" onSubmit={onSalvar}>
            <div className= "grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className= "space-y-2 md:col-span-2">
                <Label htmlFor= "nomeCompleto">Nome Completo</Label>
                <Input
                  id= "nomeCompleto"
                  value={nomeCompleto}
                  onChange={(e) => setNomeCompleto(e.target.value)}
                  placeholder= "Informe seu nome completo"
                  disabled={carregando || salvando}
                />
              </div>

              <div className= "space-y-2 md:col-span-2">
                <Label htmlFor= "email">E-mail</Label>
                <Input
                  id= "email"
                  type= "email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder= "seu@email.com.br"
                  disabled={carregando || salvando}
                />
              </div>

              <div className= "space-y-2 md:col-span-2">
                <Label htmlFor= "fotoPerfilUrl">URL da Foto de Perfil</Label>
                <Input
                  id= "fotoPerfilUrl"
                  type= "url"
                  value={fotoPerfilUrl}
                  onChange={(e) => setFotoPerfilUrl(e.target.value)}
                  placeholder= "https://exemplo.com/minha-foto.png"
                  disabled={carregando || salvando}
                />
              </div>

              {podeEditarLogoEmpresa ? (
                <div className= "space-y-2 md:col-span-2">
                  <Label htmlFor= "logoEmpresaUrl">URL da Logo da Empresa</Label>
                  <Input
                    id= "logoEmpresaUrl"
                    type= "url"
                    value={logoEmpresaUrl}
                    onChange={(e) => setLogoEmpresaUrl(e.target.value)}
                    placeholder= "https://exemplo.com/logo-da-empresa.png"
                    disabled={carregando || salvando}
                  />
                </div>
              ) : null}
            </div>

            <div className= "pt-2">
              <Button
                type= "submit"
                disabled={carregando || salvando}
                className= "bg-kx-sucesso hover:bg-kx-sucesso text-primary-foreground"
              >
                {salvando ? "Salvando..." : "Salvar Alteracoes"}
              </Button>
            </div>
          </form>
        </Card>
      </div>

      <Card className= "border-border bg-card p-6">
        <div className= "space-y-1 pb-4">
          <h2 className= "text-lg font-semibold text-foreground">Alterar Senha</h2>
          <p className= "text-sm text-muted-foreground">
            Ao trocar sua senha, todas as suas outras sessões ativas são encerradas.
          </p>
        </div>

        <form className= "space-y-4" onSubmit={onAlterarSenha}>
          <div className= "grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className= "space-y-2 md:col-span-2">
              <Label htmlFor= "senhaAtual">Senha Atual</Label>
              <Input
                id= "senhaAtual"
                type= "password"
                value={senhaAtual}
                onChange={(e) => setSenhaAtual(e.target.value)}
                autoComplete= "current-password"
                disabled={alterandoSenha}
                required
              />
            </div>

            <div className= "space-y-2">
              <Label htmlFor= "novaSenha">Nova Senha</Label>
              <Input
                id= "novaSenha"
                type= "password"
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
                placeholder= "Mínimo 8 caracteres, com letras e números"
                autoComplete= "new-password"
                disabled={alterandoSenha}
                required
              />
            </div>

            <div className= "space-y-2">
              <Label htmlFor= "confirmacaoSenha">Confirmar Nova Senha</Label>
              <Input
                id= "confirmacaoSenha"
                type= "password"
                value={confirmacaoSenha}
                onChange={(e) => setConfirmacaoSenha(e.target.value)}
                autoComplete= "new-password"
                disabled={alterandoSenha}
                required
              />
            </div>
          </div>

          <div className= "pt-2">
            <Button type= "submit" disabled={alterandoSenha} variant= "outline">
              {alterandoSenha ? "Alterando..." : "Alterar Senha"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
