# 🚀 Guia Rápido - Konext ERP Frontend

## ⚡ Quick Start

### 1. Instalar e Executar
```bash
# Instalar dependências
npm install

# Iniciar servidor de desenvolvimento
npm run dev

# Abrir em http://localhost:3000
```

### 2. Explorando o Aplicativo

#### 🔐 Página de Login
- URL: `http://localhost:3000/auth/entrar`
- Teste com qualquer email e senha (mínimo 6 caracteres)
- Validação Zod ativa

#### 📊 Dashboard Principal
- URL: `http://localhost:3000/`
- 4 KPI Cards com dados moqueados
- 2 Gráficos (Faturamento e Status de OS)
- Tabela com 5 atividades recentes

#### 👤 Perfil do Usuário
- URL: `http://localhost:3000/perfil`
- Editar dados pessoais
- Alterar senha
- Carregar foto

### 3. Recursos Principais

#### 🎨 Tema
- Clique no ícone de sol/lua no header para alternar Light/Dark mode
- Preferência salva automaticamente

#### 📱 Responsividade
- **Mobile**: Sidebar colapsível
- **Desktop**: Layout completo
- Redimensione a janela para testar

#### 🔍 Navegação
- Sidebar com 6 módulos principais
- Botão de menu para colapsar/expandir
- Breadcrumbs no header (pronto para integração)

## 📁 Estrutura de Arquivos Chave

```
Página de Login:
└── src/app/auth/entrar/page.tsx

Dashboard:
├── src/app/(dashboard)/layout.tsx          # Layout com sidebar/header
├── src/app/(dashboard)/page.tsx            # Dashboard principal
└── src/app/(dashboard)/perfil/page.tsx     # Página de perfil

Componentes:
├── src/components/layout/barralateral.tsx  # Sidebar
├── src/components/layout/cabecalho.tsx     # Header
├── src/components/dashboard/cartao-kpi.tsx
├── src/components/dashboard/grafico-faturamento.tsx
├── src/components/dashboard/grafico-status-os.tsx
└── src/components/dashboard/tabela-atividade.tsx

Dados:
└── src/dados/moqueado.ts                   # Todos os dados de exemplo
```

## 🛠️ Desenvolvimento

### Adicionar Novo Componente
1. Criar arquivo em `src/components/`
2. Usar exports named para composição
3. Adicionar comentários em PT-BR

### Adicionar Nova Página
1. Criar pasta em `src/app/`
2. Criar `page.tsx` com "use client" se interativo
3. Usar layout compartilhado quando necessário

### Atualizar Dados Mockados
1. Editar `src/dados/moqueado.ts`
2. Tipos importados de `src/tipos/indice.ts`
3. Componentes usam direto

### Estilização
- Use classes Tailwind CSS
- Suporte automático a Dark mode com `dark:` prefixo
- Variáveis CSS customizadas em `src/app/globals.css`

## 📖 Documentação Adicional

- [ARQUITETURA.md](./ARQUITETURA.md) - Visão geral da arquitetura
- [INTEGRACAO_BACKEND.md](./INTEGRACAO_BACKEND.md) - Guia de integração com API

## 🎯 Próximos Passos

### Curto Prazo (Esta Sprint)
- [ ] Integrar com API de autenticação
- [ ] Implementar carregamento real de dados do dashboard
- [ ] Adicionar feedback visual de loading

### Médio Prazo
- [ ] Implementar busca global
- [ ] Adicionar notificações em tempo real
- [ ] Criar páginas dos módulos (CRM, PDV, etc)

### Longo Prazo
- [ ] Testes automatizados
- [ ] Analytics e monitoring
- [ ] Performance optimization
- [ ] PWA support

## 🐛 Troubleshooting

### Dev Server não inicia
```bash
# Limpar cache e reinstalar
rm -r node_modules .next
npm install
npm run dev
```

### Erro de compilação TypeScript
```bash
# Verificar tipos
npm run lint

# Rebuild
npm run build
```

### Dark mode não funciona
```bash
# Certifique-se de que ThemeProvider está no layout.tsx
# Verificar em src/app/layout.tsx
```

## 📞 Suporte

Para dúvidas sobre:
- **Arquitetura**: Veja [ARQUITETURA.md](./ARQUITETURA.md)
- **Integração**: Veja [INTEGRACAO_BACKEND.md](./INTEGRACAO_BACKEND.md)
- **Código**: Consulte comentários nos arquivos

## 💡 Dicas

1. **DevTools**: Instale [React DevTools](https://react-devtools-tutorial.vercel.app/)
2. **VS Code**: Use extensão "ES7+ React/Redux" para snippets
3. **Debugging**: Abra DevTools (F12) para console e Network
4. **Performance**: Use Lighthouse para auditar performance

## 🚢 Deploy

### Para Vercel (Recomendado)
```bash
npm install -g vercel
vercel
```

### Para Docker
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY . .
RUN npm install && npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

---

**Desenvolvido com ❤️ para o Konext ERP**

Última atualização: 2026-06-05
