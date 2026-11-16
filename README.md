# Pawtastic Angular

Este projeto é uma migração do sistema Pawtastic de React para Angular 12, mantendo a compatibilidade com Node 8.

## Requisitos

- Node.js 18.x (recomendado; o `package.json` declara `engines: 18.x`)
- Docker Desktop (para o Postgres local)
- Angular CLI 12.x

## Executando o projeto

**Jeito mais simples (Windows):** rode `start.bat` — ele sobe Postgres, API e front.

**Manual:**

```bash
# 1. Subir o Postgres (Docker, porta 5433)
npm run db:up

# 2. Subir a API Node/Express (porta 3100) — em outro terminal
npm run api

# 3. Subir o front Angular (porta 4200)
npm start
```

O aplicativo estará disponível em `http://localhost:4200/`.

### Node 24+ e OpenSSL

O webpack do Angular 12 usa hash md4, bloqueado pelo OpenSSL 3 do Node 17+. Com Node 24 é preciso:

```bash
NODE_OPTIONS=--openssl-legacy-provider npm start
```

O `start.bat` já aplica essa flag. Alternativa definitiva: usar Node 18.

### Acesso

Login seed (senha `animal123` para ambos):

- `admin@animalworld.com` — role admin
- `colaborador@animalworld.com` — role collaborator

Rotas protegidas por login: `/customers`, `/dashboard`, `/appointments`, `/orders`.

## Estrutura do Projeto

- `/src/app/pages`: Contém os componentes de página (Home, Products, Services, etc.)
- `/src/app/shared`: Componentes compartilhados (Navbar, Footer, etc.)
- `/src/app/core`: Serviços e utilitários principais da aplicação
- `/src/assets`: Imagens, ícones e outros recursos estáticos

## Funcionalidades

- Sistema de gerenciamento para pet shops
- Agendamento de serviços
- Catálogo de produtos
- Gerenciamento de clientes
- Interface responsiva e moderna

## Tecnologias Utilizadas

- Angular 12
- TypeScript
- SCSS para estilos
- Angular Router para navegação
- Reactive Forms para formulários
