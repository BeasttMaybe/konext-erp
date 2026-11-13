"use client";

import { useState } from "react";
import { Check, Copy, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { gerarNovaSenhaDoUsuario, type UsuarioListado } from "@/app/actions/usuarios";
import { gerarSenhaSugerida } from "@/lib/auth/senha-sugerida";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const CAMPO = "h-11 border-kx-campo-borda bg-kx-superficie text-kx-texto placeholder:text-kx-placeholder";

/**
 * "Gerar nova senha" para alguem da loja que esqueceu a dele. A senha vem
 * sugerida (facil de ditar) e pode ser trocada antes de confirmar. Depois de
 * gerada, aparece uma vez para copiar e passar a pessoa.
 */
export function ModalNovaSenhaUsuario({
  usuario,
  onFechar,
}: {
  usuario: UsuarioListado;
  onFechar: () => void;
}) {
  const [senha, setSenha] = useState(gerarSenhaSugerida);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pronta, setPronta] = useState(false);

  const confirmar = async () => {
    setSalvando(true);
    setErro(null);
    try {
      const resultado = await gerarNovaSenhaDoUsuario({ usuarioEmpresaId: usuario.usuarioEmpresaId, novaSenha: senha });
      if (!resultado.sucesso) {
        setErro(resultado.erro);
        return;
      }
      setPronta(true);
    } catch {
      setErro("Não foi possível gerar a senha. Tente de novo.");
    } finally {
      setSalvando(false);
    }
  };

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(`Acesso ao Konext\nE-mail: ${usuario.email}\nSenha: ${senha}`);
      toast.success("Acesso copiado.");
    } catch {
      toast.error("Não foi possível copiar. Anote os dados na tela.");
    }
  };

  return (
    <Dialog open onOpenChange={(abrir) => !abrir && onFechar()}>
      <DialogContent className="sm:max-w-md">
        {pronta ? (
          <>
            <DialogHeader>
              <DialogTitle>Senha nova pronta</DialogTitle>
              <DialogDescription>
                Passe estes dados para {usuario.nome}. Os acessos que estavam abertos foram encerrados; a pessoa pode
                trocar a senha depois em &quot;Meu perfil&quot;.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-2 rounded-kx-botao border border-kx-campo-borda bg-kx-superficie p-3 text-sm">
              <p className="text-kx-texto-2">
                E-mail: <span className="font-semibold text-kx-texto">{usuario.email}</span>
              </p>
              <p className="text-kx-texto-2">
                Senha: <span className="font-mono font-semibold text-kx-texto">{senha}</span>
              </p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => void copiar()}>
                <Copy className="h-4 w-4" />
                Copiar acesso
              </Button>
              <Button type="button" onClick={onFechar}>
                <Check className="h-4 w-4" />
                Concluir
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Gerar nova senha</DialogTitle>
              <DialogDescription>
                Para {usuario.nome} ({usuario.email}). A senha antiga deixa de funcionar e os acessos abertos são
                encerrados.
              </DialogDescription>
            </DialogHeader>
            <form
              className="flex flex-col gap-4"
              onSubmit={(evento) => {
                evento.preventDefault();
                // Mesmo cuidado do modal de novo usuario: nao deixa o envio subir
                // ate o formulario de Configuracoes.
                evento.stopPropagation();
                void confirmar();
              }}
            >
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="nova-senha-usuario" className="text-xs font-bold text-kx-texto">
                  Nova senha
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="nova-senha-usuario"
                    autoComplete="new-password"
                    autoCapitalize="none"
                    spellCheck={false}
                    className={`${CAMPO} flex-1 font-mono`}
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                  />
                  <Button type="button" variant="outline" className="h-11" onClick={() => setSenha(gerarSenhaSugerida())}>
                    <RefreshCw className="h-4 w-4" />
                    Outra
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
                  Gerar nova senha
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
