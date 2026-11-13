"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Eye, EyeOff, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { listarCargos, type CargoListado } from "@/app/actions/cargos";
import { criarUsuario } from "@/app/actions/usuarios";
import { gerarSenhaSugerida } from "@/lib/auth/senha-sugerida";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const CAMPO = "h-11 border-kx-campo-borda bg-kx-superficie text-kx-texto placeholder:text-kx-placeholder";

type Criado = { nome: string; email: string; senha: string | null };

export function ModalNovoUsuario({
  aberto,
  onFechar,
  onCriado,
}: {
  aberto: boolean;
  onFechar: () => void;
  onCriado: () => void;
}) {
  const [cargos, setCargos] = useState<CargoListado[] | null>(null);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [cargoId, setCargoId] = useState("");
  const [senha, setSenha] = useState(gerarSenhaSugerida);
  const [mostrarSenha, setMostrarSenha] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [criado, setCriado] = useState<Criado | null>(null);

  useEffect(() => {
    listarCargos().then((resultado) => {
      if (resultado.sucesso) setCargos(resultado.dados.filter((cargo) => !cargo.arquivadoEm));
      else toast.error(resultado.erro);
    });
  }, []);

  const salvar = async () => {
    setSalvando(true);
    setErro(null);
    try {
      const resultado = await criarUsuario({ nome, email, cargoId, senhaInicial: senha });
      if (!resultado.sucesso) {
        setErro(resultado.erro);
        return;
      }
      onCriado();
      setCriado({ nome: nome.trim(), email: email.trim().toLowerCase(), senha: resultado.contaJaExistia ? null : senha });
    } finally {
      setSalvando(false);
    }
  };

  const copiarAcesso = async () => {
    if (!criado?.senha) return;
    try {
      await navigator.clipboard.writeText(`Acesso ao Konext\nE-mail: ${criado.email}\nSenha: ${criado.senha}`);
      toast.success("Acesso copiado.");
    } catch {
      toast.error("Não foi possível copiar. Anote os dados na tela.");
    }
  };

  return (
    <Dialog open={aberto} onOpenChange={(abrir) => !abrir && onFechar()}>
      <DialogContent className="sm:max-w-md">
        {criado ? (
          <>
            <DialogHeader>
              <DialogTitle>Usuário cadastrado</DialogTitle>
              <DialogDescription>
                {criado.senha
                  ? `Passe estes dados para ${criado.nome}. A senha pode ser trocada depois em "Meu perfil".`
                  : `${criado.nome} já tinha conta no Konext e entra com a senha que já usa.`}
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-2 rounded-kx-botao border border-kx-campo-borda bg-kx-superficie p-3 text-sm">
              <p className="text-kx-texto-2">
                E-mail: <span className="font-semibold text-kx-texto">{criado.email}</span>
              </p>
              {criado.senha ? (
                <p className="text-kx-texto-2">
                  Senha: <span className="font-mono font-semibold text-kx-texto">{criado.senha}</span>
                </p>
              ) : null}
            </div>
            <DialogFooter>
              {criado.senha ? (
                <Button type="button" variant="outline" onClick={() => void copiarAcesso()}>
                  <Copy className="h-4 w-4" />
                  Copiar acesso
                </Button>
              ) : null}
              <Button type="button" onClick={onFechar}>
                <Check className="h-4 w-4" />
                Concluir
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Novo usuário</DialogTitle>
              <DialogDescription>A pessoa entra no sistema com o e-mail e a senha inicial abaixo.</DialogDescription>
            </DialogHeader>

            <form
              className="flex flex-col gap-4"
              onSubmit={(evento) => {
                evento.preventDefault();
                // O modal vive num portal, mas no React o evento de envio
                // continua subindo pela arvore de componentes — ate o
                // formulario da pagina de Configuracoes, que salvaria TODAS
                // as configuracoes junto. Para aqui.
                evento.stopPropagation();
                void salvar();
              }}
            >
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="novo-usuario-nome" className="text-xs font-bold text-kx-texto">
                  Nome
                </Label>
                <Input
                  id="novo-usuario-nome"
                  className={CAMPO}
                  autoComplete="off"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="novo-usuario-email" className="text-xs font-bold text-kx-texto">
                  E-mail (usado para entrar)
                </Label>
                <Input
                  id="novo-usuario-email"
                  type="email"
                  inputMode="email"
                  autoComplete="off"
                  autoCapitalize="none"
                  className={CAMPO}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="novo-usuario-cargo" className="text-xs font-bold text-kx-texto">
                  Cargo
                </Label>
                <Select value={cargoId} onValueChange={setCargoId} disabled={!cargos}>
                  <SelectTrigger id="novo-usuario-cargo" className="h-11 border-kx-campo-borda bg-kx-superficie">
                    <SelectValue placeholder={cargos ? "Selecione um cargo" : "Carregando cargos..."} />
                  </SelectTrigger>
                  <SelectContent>
                    {(cargos ?? []).map((cargo) => (
                      <SelectItem key={cargo.id} value={cargo.id}>
                        {cargo.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-kx-legenda">O cargo define o que a pessoa pode ver e fazer.</p>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="novo-usuario-senha" className="text-xs font-bold text-kx-texto">
                  Senha inicial
                </Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      id="novo-usuario-senha"
                      type={mostrarSenha ? "text" : "password"}
                      autoComplete="new-password"
                      autoCapitalize="none"
                      spellCheck={false}
                      className={`${CAMPO} pr-11 font-mono`}
                      value={senha}
                      onChange={(e) => setSenha(e.target.value)}
                    />
                    <button
                      type="button"
                      className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-kx-botao text-kx-legenda hover:text-kx-texto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kx-foco"
                      aria-label={mostrarSenha ? "Esconder senha" : "Mostrar senha"}
                      onClick={() => setMostrarSenha((atual) => !atual)}
                    >
                      {mostrarSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <Button type="button" variant="outline" className="h-11" onClick={() => setSenha(gerarSenhaSugerida())}>
                    <RefreshCw className="h-4 w-4" />
                    Gerar
                  </Button>
                </div>
                <p className="text-xs text-kx-legenda">Mínimo de 8 caracteres, com letras e números.</p>
              </div>

              {erro ? (
                <p role="alert" className="rounded-kx-botao border border-kx-erro bg-kx-erro-fundo px-3 py-2 text-sm text-kx-erro-texto">
                  {erro}
                </p>
              ) : null}

              <DialogFooter>
                <Button type="button" variant="outline" onClick={onFechar} disabled={salvando}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={salvando}>
                  {salvando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                  Cadastrar usuário
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
