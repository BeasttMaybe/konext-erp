# Guia de Integração com Backend

## 🔌 Padrões de Integração

Este guia descreve os padrões recomendados para integrar o Konext Frontend com um backend.

## 📡 Camada de API

### 1. Criar Cliente HTTP (Axios)

```typescript
// src/lib/api.ts
import axios from "axios";

const cliente = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api",
  headers: {
    "Content-Type": "application/json",
  },
});

// Interceptor para adicionar token JWT
cliente.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default cliente;
```

### 2. Serviços de API

```typescript
// src/servicos/autenticacao.ts
import cliente from "@/lib/api";

export interface CredenciaisEntrada {
  email: string;
  senha: string;
}

export interface RespostaEntrada {
  token: string;
  usuario: {
    id: string;
    nome: string;
    email: string;
  };
}

export const autenticacaoServico = {
  async entrar(credenciais: CredenciaisEntrada): Promise<RespostaEntrada> {
    const resposta = await cliente.post("/auth/login", credenciais);
    return resposta.data;
  },

  async sair(): Promise<void> {
    await cliente.post("/auth/logout");
    localStorage.removeItem("token");
  },
};
```

```typescript
// src/servicos/dashboard.ts
import cliente from "@/lib/api";
import { CartaoKPI, DadosFaturamento } from "@/tipos/indice";

export const dashboardServico = {
  async obterKPIs(): Promise<CartaoKPI[]> {
    const resposta = await cliente.get("/dashboard/kpis");
    return resposta.data;
  },

  async obterFaturamento(): Promise<DadosFaturamento[]> {
    const resposta = await cliente.get("/dashboard/faturamento");
    return resposta.data;
  },

  async obterStatusOS() {
    const resposta = await cliente.get("/dashboard/status-os");
    return resposta.data;
  },

  async obterAtividadesRecentes() {
    const resposta = await cliente.get("/dashboard/atividades");
    return resposta.data;
  },
};
```

## 🎣 Hooks Customizados com React Query

### 1. Hook para Dashboard

```typescript
// src/hooks/useDashboard.ts
import { useQuery } from "@tanstack/react-query";
import { dashboardServico } from "@/servicos/dashboard";

export function useDashboard() {
  const kpisQuery = useQuery({
    queryKey: ["dashboard", "kpis"],
    queryFn: () => dashboardServico.obterKPIs(),
    staleTime: 5 * 60 * 1000, // 5 minutos
  });

  const faturamentoQuery = useQuery({
    queryKey: ["dashboard", "faturamento"],
    queryFn: () => dashboardServico.obterFaturamento(),
    staleTime: 5 * 60 * 1000,
  });

  const statusOSQuery = useQuery({
    queryKey: ["dashboard", "status-os"],
    queryFn: () => dashboardServico.obterStatusOS(),
    staleTime: 5 * 60 * 1000,
  });

  const atividadesQuery = useQuery({
    queryKey: ["dashboard", "atividades"],
    queryFn: () => dashboardServico.obterAtividadesRecentes(),
    staleTime: 2 * 60 * 1000, // 2 minutos (dados mais frescos)
  });

  return {
    kpis: kpisQuery.data || [],
    faturamento: faturamentoQuery.data || [],
    statusOS: statusOSQuery.data || [],
    atividades: atividadesQuery.data || [],
    eCarregando:
      kpisQuery.isLoading ||
      faturamentoQuery.isLoading ||
      statusOSQuery.isLoading ||
      atividadesQuery.isLoading,
    erros:
      kpisQuery.error ||
      faturamentoQuery.error ||
      statusOSQuery.error ||
      atividadesQuery.error,
  };
}
```

## 🔄 Integração na Página de Dashboard

### Antes (com dados moqueados)

```typescript
// src/app/(dashboard)/page.tsx
import { kpisExemplo, dadosFaturamento } from "@/dados/moqueado";

export default function PaginaDashboard() {
  return (
    <div>
      <CartaoKPI {...kpisExemplo[0]} />
    </div>
  );
}
```

### Depois (com API)

```typescript
"use client";

import { useDashboard } from "@/hooks/useDashboard";
import { CartaoKPI } from "@/components/dashboard/cartao-kpi";
import { Loader2 } from "lucide-react";

export default function PaginaDashboard() {
  const { kpis, faturamento, statusOS, atividades, eCarregando, erros } = useDashboard();

  if (eCarregando) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (erros) {
    return (
      <div className="p-4 text-red-600">
        Erro ao carregar dados do dashboard
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {kpis.map((kpi) => (
          <CartaoKPI key={kpi.id} {...kpi} />
        ))}
      </div>
      {/* resto do dashboard */}
    </div>
  );
}
```

## 🔐 Autenticação e Contexto

### 1. Contexto de Autenticação

```typescript
// src/contextos/autenticacao.tsx
"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { autenticacaoServico } from "@/servicos/autenticacao";

interface Usuario {
  id: string;
  nome: string;
  email: string;
}

interface ContextoAutenticacao {
  usuario: Usuario | null;
  estaAutenticado: boolean;
  carregando: boolean;
  entrar: (email: string, senha: string) => Promise<void>;
  sair: () => Promise<void>;
}

const ContextoAutenticacao = createContext<ContextoAutenticacao | undefined>(
  undefined
);

export function ProvedorAutenticacao({ children }: { children: React.ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [carregando, setCarregando] = useState(true);

  // Verificar autenticação ao montar
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      // Validar token com backend
      // setUsuario(dadosDoToken)
    }
    setCarregando(false);
  }, []);

  const entrar = async (email: string, senha: string) => {
    const resposta = await autenticacaoServico.entrar({ email, senha });
    localStorage.setItem("token", resposta.token);
    setUsuario(resposta.usuario);
  };

  const sair = async () => {
    await autenticacaoServico.sair();
    setUsuario(null);
  };

  return (
    <ContextoAutenticacao.Provider
      value={{
        usuario,
        estaAutenticado: !!usuario,
        carregando,
        entrar,
        sair,
      }}
    >
      {children}
    </ContextoAutenticacao.Provider>
  );
}

export function useAutenticacao() {
  const contexto = useContext(ContextoAutenticacao);
  if (!contexto) {
    throw new Error(
      "useAutenticacao deve ser usado dentro de ProvedorAutenticacao"
    );
  }
  return contexto;
}
```

### 2. Usar no Layout

```typescript
// src/app/layout.tsx
import { ProvedorAutenticacao } from "@/contextos/autenticacao";

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>
        <ThemeProvider>
          <ProvedorAutenticacao>
            {children}
          </ProvedorAutenticacao>
        </ThemeProvider>
      </body>
    </html>
  );
}
```

## 📤 Exemplo: Integração de Página de Perfil

```typescript
// src/servicos/perfil.ts
import cliente from "@/lib/api";

export interface DadosPerfil {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  departamento: string;
  avatar?: string;
}

export const perfilServico = {
  async obter(): Promise<DadosPerfil> {
    const resposta = await cliente.get("/perfil");
    return resposta.data;
  },

  async atualizar(dados: Partial<DadosPerfil>): Promise<DadosPerfil> {
    const resposta = await cliente.put("/perfil", dados);
    return resposta.data;
  },

  async alterarSenha(senhaAtual: string, novaSenha: string): Promise<void> {
    await cliente.post("/perfil/alterar-senha", {
      senhaAtual,
      novaSenha,
    });
  },

  async uploadFoto(arquivo: File): Promise<string> {
    const formData = new FormData();
    formData.append("arquivo", arquivo);
    const resposta = await cliente.post("/perfil/avatar", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return resposta.data.avatarUrl;
  },
};
```

```typescript
// Na página de perfil
import { useMutation, useQuery } from "@tanstack/react-query";
import { perfilServico } from "@/servicos/perfil";

export default function PaginaPerfil() {
  const { data: perfil, isLoading } = useQuery({
    queryKey: ["perfil"],
    queryFn: () => perfilServico.obter(),
  });

  const { mutate: atualizarPerfil, isPending } = useMutation({
    mutationFn: (dados) => perfilServico.atualizar(dados),
    onSuccess: () => {
      // Revalidar dados
      queryClient.invalidateQueries({ queryKey: ["perfil"] });
    },
  });

  if (isLoading) return <Loading />;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        atualizarPerfil(new FormData(e.currentTarget));
      }}
    >
      {/* formulário */}
    </form>
  );
}
```

## 🧪 Exemplo de Testes

```typescript
// src/__tests__/servicos/autenticacao.test.ts
import { autenticacaoServico } from "@/servicos/autenticacao";

vi.mock("@/lib/api", () => ({
  default: {
    post: vi.fn(),
  },
}));

describe("autenticacaoServico", () => {
  it("deve fazer login com credenciais válidas", async () => {
    const resposta = await autenticacaoServico.entrar({
      email: "teste@konext.com.br",
      senha: "senha123",
    });

    expect(resposta.token).toBeDefined();
    expect(resposta.usuario).toBeDefined();
  });
});
```

## 📋 Checklist de Integração

- [ ] Setup do cliente Axios
- [ ] Criação de serviços de API
- [ ] Implementação de hooks com React Query
- [ ] Setup do contexto de autenticação
- [ ] Integração na página de login
- [ ] Integração na página do dashboard
- [ ] Integração na página de perfil
- [ ] Setup de interceptors de erro
- [ ] Implementação de refresh token
- [ ] Testes unitários
- [ ] Testes de integração

---

**Pronto para se conectar ao backend Konext!**
