# 00 — Análise de gap: requisitos Thaina × sysPet2

Auditoria do código real (16/11/2026): `server/index.js` (~50 endpoints), `server/schema.sql`, `src/app/pages` (Angular).
Fonte de requisitos: `OpenBot\Shared\animal-world-req-thaina.md`

## O que JÁ EXISTE e funciona

| Capacidade | Implementação |
|---|---|
| Auth + papéis | `admin` / `collaborator` / `customer` + flag `can_manage_products` |
| Clientes e pets | CRUD; pet vinculado a customer (1:N); foto do pet |
| Produtos + estoque | `products.stock` (NULL=sem controle); baixa automática no pedido + validação |
| Pedidos | `orders` c/ items JSONB, cupom, desconto, nº AW-XXXX, gera `cash_movement` |
| Caixa | `cash_movements` entrada/saída + export CSV pro contador (só admin) |
| Catálogo de serviços | `catalog_services` preço flat, vitrine pública |
| Agendamentos | `appointments` c/ data/hora/status — **MANTIDO** (consultório domicílio + futuro) |
| Consultório vet | `vets` + `consultations` + `prescriptions` c/ itens e PDF |
| Extras | cupons, audit_log, LGPD export/delete, upload, relatórios admin |

## Gaps por card do backlog

| Card | Gap principal no código |
|---|---|
| 01 Fila do dia | `appointments` exige data futura (`minDate=amanhã`) — incompatível c/ ordem de chegada. Falta entidade de atendimento diário: check-in, posição, ETA, capacidade ~50/dia, checklist saúde, validação humana de tosas |
| 02 Preço por porte | `pets` sem `weight`; `catalog_services.price` flat — precisa matriz porte×serviço + raças + extras |
| 03 Venda de serviços | `orders` só aceita `products` — banho/tosa/táxi não vendem, não geram caixa |
| 04 Táxi dog | Seed flat R$49,90 — falta regiões, endereço/condomínio→preço, status motorista |
| 05 WhatsApp | Zero integração — Evolution API disponível; human-in-the-loop + notificações de status |
| 06 Comissão | Não existe cadastro de tosador nem cálculo — 15% c/ rateio em dupla |
| 07 Estoque | Base pronta (stock+baixa auto); falta entrada de mercadoria, mínimo, PDV balcão, popular stock |
| 08 Financeiro | `cash_movements` só admin; falta contas a pagar c/ vencimento + visão de fechamento |
| 09 Pacotes | Nada — créditos mensais por pet |
| 10 Expediente | Nada — horário por dia + capacidade por tipo de dia |
| 11 Consultório | Módulo existe; presencial walk-in não cabe no modelo data/hora; vacinas sem entidade própria |

## Decisão do dono registrada

`appointments` **permanece** — banho/tosa usa entidade nova de fila do dia; agendamento serve consultório a domicílio e uso futuro.
