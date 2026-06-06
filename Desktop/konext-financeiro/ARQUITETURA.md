# Konext ERP - Documentação da Arquitetura Frontend

## 📋 Visão Geral

Konext é uma plataforma moderna de ERP (Enterprise Resource Planning) construída com as mais recentes tecnologias frontend. Este documento descreve a arquitetura, estrutura de arquivos e convenções utilizadas no projeto.

## 🏗️ Arquitetura e Estrutura do Projeto

```
src/
├── app/                           # Aplicação Next.js com App Router
│   ├── layout.tsx                # Layout raiz com ThemeProvider
│   ├── page.tsx                  # Página raiz (redireciona para dashboard)
│   ├── globals.css               # Estilos globais
│   ├── auth/                     # Rotas de autenticação
│   │   ├── layout.tsx            # Layout da página de login
│   │   └── entrar/
│   │       └── page.tsx          # Página de login
│   └── (dashboard)/              # Rotas do dashboard (com layout compartilhado)
│       ├── layout.tsx            # Layout do dashboard com sidebar e header
│       ├── page.tsx              # Página inicial do dashboard
│       └── perfil/
│           └── page.tsx          # Página de perfil do usuário
├── components/                   # Componentes reutilizáveis
│   ├── layout/                   # Componentes de layout
│   │   ├── barralateral.tsx      # Sidebar de navegação
│   │   ├── cabecalho.tsx         # Header com busca e perfil
│   │   └── rodape.tsx            # Footer
│   ├── dashboard/                # Componentes específicos do dashboard
│   │   ├── cartao-kpi.tsx        # Card para indicadores KPI
│   │   ├── grafico-faturamento.tsx  # Gráfico de faturamento
│   │   ├── grafico-status-os.tsx    # Gráfico de status de OS
│   │   └── tabela-atividade.tsx     # Tabela de atividades recentes
│   └── ui/                       # Componentes de UI (Shadcn/ui)
│       ├── avatar.tsx
│       ├── badge.tsx
│       ├── button.tsx
│       ├── card.tsx
│       ├── dropdown-menu.tsx
│       ├── input.tsx
│       └── label.tsx
├── tipos/                        # Tipos TypeScript
│   └── indice.ts                # Interfaces principais
├── dados/                        # Dados mockados
│   └── moqueado.ts              # Dados de exemplo para o desenvolvimento
└── lib/                          # Utilitários
    ├── utils.ts                 # Funções utilitárias gerais
    └── formatadores.ts          # Funções de formatação (moeda, datas)
```

## 🎨 Design System

### Paleta de Cores

#### Tons Neutros (Layout)
- **Zinc**: Cores neutras para backgrounds e bordas
- **Slate**: Tons mais frios para textos e elementos principais
- **White/Black**: Fundos básicos

#### Cores Vibrantes (Dados)
- **Emerald Green**: `#10b981` - Receita e valores positivos
- **Blue**: `#3b82f6` - Informações e dados secundários
- **Violet**: `#8b5cf6` - Dados terciários
- **Orange**: `#f97316` - Dados terciários adicionais
- **Red**: `#ef4444` - Alertas e valores negativos

### Tipografia

- **Fonte Principal**: Geist (Sans-serif)
- **Fonte Monoespacada**: Geist Mono (para código)

### Componentes Principais

1. **Sidebar**: Navegação colapsível com ícones
2. **Header**: Barra superior com busca, notificações, tema e perfil
3. **KPI Cards**: Cards com indicadores e tendências
4. **Charts**: Gráficos de área e donut com Recharts
5. **Tabelas**: Tabelas de dados com status visual
6. **Modais/Dropdowns**: Menus de contexto

## 📄 Páginas Implementadas

### 1. Página de Login (`/auth/entrar`)
- Formulário com validação Zod
- Email e senha
- Loading state no botão
- Design minimalista e centrado

### 2. Dashboard Principal (`/`)
- **4 KPI Cards**: Faturamento, OS Concluídas, Vendas PDV, Clientes Ativos
- **Gráfico de Faturamento**: Últimos 6 meses com meta
- **Gráfico de Status OS**: Distribuição em Donut
- **Tabela de Atividades**: 5 transações mais recentes

### 3. Página de Perfil (`/perfil`)
- **Seção de Avatar**: Com foto do usuário e opção de alterar
- **Formulário de Dados Pessoais**: Nome, email, telefone, departamento
- **Formulário de Segurança**: Alteração de senha

## 🛠️ Tecnologias Utilizadas

### Core
- **Next.js 14+**: Framework React com App Router
- **React 19**: Biblioteca UI
- **TypeScript**: Type safety

### Styling
- **Tailwind CSS**: Utility-first CSS
- **Class Variance Authority**: Variações de componentes

### Formulários
- **React Hook Form**: Gerenciamento de formulários
- **Zod**: Validação de esquemas

### Visualização
- **Recharts**: Gráficos e charts
- **Lucide React**: Ícones

### Tema
- **Next-themes**: Suporte a Light/Dark mode

### State Management
- **Zustand**: State management (preparado para uso futuro)

### API
- **Axios**: Cliente HTTP
- **React Query**: Cache de dados

## 📝 Convenções de Código

### Nomes em Português (PT-BR)
- Todas as variáveis, funções e interfaces em português
- Comentários em português
- Texto da UI em português

Exemplos:
```typescript
// ✅ Correto
const formatarMoedaBrasileira = (valor: number) => { }
const dadosFaturamento: DadosFaturamento[] = []
const aoEnviar = (dados: DadosEntrada) => { }

// ❌ Incorreto
const formatCurrency = (value: number) => { }
const revenueData: Revenue[] = []
const onSubmit = (data: LoginData) => { }
```

### Estrutura de Componentes
```typescript
"use client"; // Para componentes interativos

import { useState } from "react";

/**
 * Descrição do componente em comentário
 */
export function NomeComponente() {
  return (
    // JSX
  );
}
```

### Tipos e Interfaces
```typescript
// Em src/tipos/indice.ts
export interface NomeDados {
  id: string;
  titulo: string;
  valor: number;
}
```

### Dados Mockados
```typescript
// Em src/dados/moqueado.ts
export const dadosExemplo: NomeDados[] = [
  // dados...
];
```

## 🔧 Funcionalidades Implementadas

### Autenticação
- [x] Página de login com validação
- [ ] Integração com backend (pronto para)
- [ ] Persistência de sessão

### Dashboard
- [x] Layout responsivo
- [x] Sidebar colapsível
- [x] Header com busca
- [x] KPI cards
- [x] Gráficos
- [x] Tabela de atividades

### Perfil
- [x] Edição de dados pessoais
- [x] Alteração de senha
- [x] Upload de foto
- [x] Validação de formulários

### Tema
- [x] Light/Dark mode
- [x] Persistência de preferência
- [x] Transições suaves

## 🚀 Como Iniciar

### Desenvolvimento
```bash
npm run dev
# Acesse http://localhost:3000
```

### Produção
```bash
npm run build
npm start
```

### Lint
```bash
npm run lint
```

## 📊 Dados Mockados

Os dados mockados estão localizados em `src/dados/moqueado.ts` e incluem:

- **KPIs**: Faturamento, OS, Vendas, Clientes
- **Gráfico de Faturamento**: 6 meses de dados
- **Status de OS**: Distribuição por status
- **Transações Recentes**: 5 transações de exemplo
- **Usuário**: Dados do usuário autenticado
- **Menu de Navegação**: Itens do sidebar

## 🔄 Fluxo de Integração Backend

Para integrar com um backend:

1. **Autenticação**: Substituir mockados em `src/app/auth/entrar/page.tsx`
2. **Dashboard Data**: Chamar API em `src/app/(dashboard)/page.tsx`
3. **Perfil**: Integrar PUT/POST endpoints em `src/app/(dashboard)/perfil/page.tsx`
4. **Sidebar**: Carregar menu dinamicamente de `src/components/layout/barralateral.tsx`

## 📱 Responsividade

- **Mobile**: Sidebar colapsível, grid único
- **Tablet**: Grid 2 colunas, sidebar visível
- **Desktop**: Grid completo, sidebar totalmente expandido

## ♿ Acessibilidade

- Componentes Shadcn/ui (accessibility-first)
- Labels associados a inputs
- Navegação por teclado
- Contrast adequado em Light/Dark mode

## 📚 Recursos Úteis

- [Next.js Docs](https://nextjs.org/docs)
- [Tailwind CSS](https://tailwindcss.com)
- [Shadcn/ui](https://ui.shadcn.com)
- [React Hook Form](https://react-hook-form.com)
- [Zod](https://zod.dev)
- [Recharts](https://recharts.org)

## 📝 Próximos Passos

1. Integração com backend
2. Implementação de autenticação real
3. Setup de CI/CD
4. Testes unitários e E2E
5. Otimizações de performance
6. Analytics e monitoring

---

**Desenvolvido com ❤️ para o Konext ERP**
