# 🐾 Animal World - Sistema de Gerenciamento Pet (sysPet2)

[![GitHub Pages](https://img.shields.io/badge/Deploy-GitHub%20Pages-success?style=flat-square&logo=github)](https://trd-consultoria-ti.github.io/sysPet2/)
[![Angular](https://img.shields.io/badge/Angular-12.2-DD0031?style=flat-square&logo=angular)](https://angular.io/)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?style=flat-square&logo=node.js)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-4169E1?style=flat-square&logo=postgresql)](https://www.postgresql.org/)
[![Express](https://img.shields.io/badge/Express-4.x-black?style=flat-square&logo=express)](https://expressjs.com/)
[![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)](LICENSE)

Plataforma completa para gestão de pet shops, clínicas veterinárias e e-commerce de produtos e serviços para animais de estimação. O sistema combina uma experiência moderna para clientes (agendamentos online, catálogo de produtos e serviços, carrinho e checkout) com um painel administrativo robusto para gestão clínica, financeira e operacional.

🌐 **Acesse a demonstração em produção:** [https://trd-consultoria-ti.github.io/sysPet2/](https://trd-consultoria-ti.github.io/sysPet2/)

---

## 🚀 Principais Funcionalidades

### 🐶 Para Clientes
- **Catálogo de Produtos e Serviços:** Navegação com visualização em cards unificados, busca inteligente e filtros dinâmicos (categorias, faixa de preço, avaliação e duração).
- **Agendamento Online:** Marcação de serviços (banho, tosa, consultas) vinculada automaticamente ao usuário autenticado e seus pets cadastrados.
- **E-commerce Completo:** Carrinho de compras reativo, aplicação e validação de cupons de desconto, checkout e histórico em "Meus Pedidos".
- **Gestão de Pets:** Cadastro de animais de estimação com histórico de consultas e agendamentos.
- **Privacidade e LGPD:** Exportação completa de dados cadastrais (`/api/me/export`) e direito ao esquecimento com exclusão de conta (`/api/me`).

### 🩺 Módulo Veterinário & Atendimento
- **Prontuário e Consultas:** Registro clínico, sintomas, diagnósticos e histórico médico por pet.
- **Prescrições e Receitas:** Emissão de receitas médicas com exportação para PDF.
- **Gestão de Equipe:** Cadastro e gerenciamento de veterinários e profissionais de atendimento.

### 💼 Gestão Administrativa (Dashboard)
- **Controle Operacional:** Acompanhamento de agendamentos em tempo real com indicação clara do cliente responsável.
- **Gestão de Pedidos:** Atualização e acompanhamento de status de pedidos de produtos.
- **Módulo Financeiro:** Controle de fluxo de caixa com entradas/saídas e exportação de relatórios em CSV.
- **Gestão de Catálogo:** Criação, edição e exclusão de produtos e serviços, com upload de imagens.
- **Auditoria de Sistema:** Registro de logs de ações administrativas para segurança e conformidade.

---

## 🛠️ Tecnologias Utilizadas

### Frontend
- **Angular 12** com **TypeScript** e **SCSS**
- **Arquitetura Baseada em Componentes:** Componentes modulares reutilizáveis (`<app-item-card>`, `<app-item-list>`, `<app-search-bar>`, `<app-filter-panel>`, `<app-logo>`)
- **Estratégia de Roteamento:** `HashLocationStrategy` (`useHash: true`) garantindo compatibilidade total com GitHub Pages e servidores estáticos
- **PWA (Progressive Web App):** Habilitado com Service Worker para cache e desempenho
- **Acessibilidade:** Padrões WCAG AA com navegação por teclado e rótulos ARIA

### Backend & Banco de Dados
- **Node.js** e **Express 4** com arquitetura RESTful
- **PostgreSQL 15** para armazenamento relacional persistente
- **Segurança de Autenticação:**
  - Hashing de senhas com **bcrypt**
  - Sessões gerenciadas via tokens server-side com revogação em logout e troca de senha
  - Proteção contra força bruta com **rate limiting** no login e recuperação de senha
  - Controle de acesso baseado em papéis (**RBAC**: `admin`, `staff`, `product_manager`, `customer`)

---

## 📁 Estrutura do Projeto

```text
sysPet2/
├── docs/                        # Build de produção publicado no GitHub Pages
│   ├── index.html               # Ponto de entrada com <base href="/sysPet2/">
│   └── 404.html                 # Roteamento SPA para GitHub Pages
├── server/                      # Backend Node.js / Express
│   ├── index.js                 # Servidor HTTP e endpoints da API REST
│   ├── schema.sql               # Esquema do banco de dados PostgreSQL
│   ├── seed.sql                 # Dados iniciais de teste (produtos, serviços, admin)
│   └── package.json             # Dependências da API
├── src/                         # Código-fonte do Frontend Angular
│   ├── app/
│   │   ├── pages/               # Módulos e páginas (home, products, services, appointments, etc.)
│   │   ├── shared/              # Componentes, pipes, guards e serviços reutilizáveis
│   │   │   ├── components/      # item-card, item-list, search-bar, filter-panel, logo, etc.
│   │   │   ├── guards/          # auth.guard, staff.guard
│   │   │   └── services/        # auth, product, appointment, cart, order, etc.
│   │   └── app-routing.module.ts # Configuração de rotas com useHash: true
│   ├── assets/                  # Imagens transparentes (logo.png), ícones e fontes
│   └── environments/            # Configurações de ambiente (dev / prod)
├── angular.json                 # Configuração do Angular CLI e build para GitHub Pages
├── docker-compose.yml           # Configuração do banco PostgreSQL
└── package.json                 # Dependências e scripts do Frontend
```

---

## ⚙️ Pré-requisitos

- [Node.js](https://nodejs.org/) 18.x ou superior
- [Docker Desktop](https://www.docker.com/) (para subir o PostgreSQL local)
- [npm](https://www.npmjs.com/) (gerenciador de pacotes)

---

## 🏃 Como Executar Localmente

### Opção 1: Inicialização Automática (Windows)
Execute o script em lote na raiz do projeto:
```cmd
start.bat
```
O script iniciará o contêiner do PostgreSQL, a API Express (porta `3100`) e o servidor de desenvolvimento do Angular (porta `4200`).

---

### Opção 2: Inicialização Passo a Passo

#### 1. Iniciar o Banco de Dados (PostgreSQL)
```bash
npm run db:up
```
> O banco subirá via Docker na porta **5433** com credenciais padrões: usuário `animalworld`, senha `animalworld` e database `animalworld`.

#### 2. Iniciar a API (Backend)
Em um novo terminal:
```bash
npm run api
```
A API estará em execução em `http://localhost:3100/`.

#### 3. Iniciar o Frontend (Angular)
Em outro terminal:
```bash
# Para Node.js 17+ (aplica o provedor OpenSSL legado do webpack 4/5 do Angular 12)
$env:NODE_OPTIONS="--openssl-legacy-provider"; npm start
```
Acesse a aplicação em: **`http://localhost:4200/`**.

---

## 🔑 Credenciais de Acesso (Ambiente Local)

| Papel | E-mail | Senha |
|---|---|---|
| **Administrador** | `admin@animalworld.com` | `animal123` |

> Clientes podem se cadastrar livremente pela página de Login/Cadastro (`#/login`). Novos funcionários e administradores podem ser cadastrados pelo painel em `#/dashboard`.

---

## 📦 Scripts Disponíveis

| Comando | Descrição |
|---|---|
| `npm start` | Inicia o servidor de desenvolvimento do Angular (`ng serve`) |
| `npm run build` | Compila o frontend para produção com saída na pasta `docs/` (`--base-href /sysPet2/`) |
| `npm run build:gh-pages` | Comando explícito de build otimizado para deploy no GitHub Pages |
| `npm run api` | Inicia o servidor backend Express (`node server/index.js`) |
| `npm run db:up` | Sobe o contêiner Docker do PostgreSQL na porta 5433 |
| `npm test` | Executa a suíte de testes unitários com Karma |

---

## 🌐 Deploy no GitHub Pages

O projeto está configurado para publicação automática a partir do diretório `docs/` na branch `main`:

1. Para gerar um novo build de produção atualizado:
   ```bash
   npm run build:gh-pages
   ```
2. Faça o commit e push para o repositório:
   ```bash
   git add docs/
   git commit -m "docs: atualiza build de produção"
   git push origin main
   ```
3. O GitHub Pages atualizará automaticamente o site na URL oficial:  
   👉 **[https://trd-consultoria-ti.github.io/sysPet2/](https://trd-consultoria-ti.github.io/sysPet2/)**

---

## 🏢 Organização

Desenvolvido para **[TRD Consultoria e Serviços de TI](https://github.com/trd-consultoria-ti)**.
