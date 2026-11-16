# Backlog — Animal World (sysPet2)

Backlog construído a partir da entrevista com **Thainá Duarte** (dona), 16/11/2026.
Fonte completa de requisitos: `OpenBot\Shared\animal-world-req-thaina.md`

## Regra de ouro do negócio

> "Atendimento de segunda a sábado **por ordem de chegada — não realizamos agendamento**"

O sistema NÃO é uma agenda de horários. É uma **lista do dia** com fila, posição e previsão de saída.

## Prioridade declarada por ela

1. **Banho e tosa** — controle rigoroso (itens 01–03)
2. **Automatizar mensagens de WhatsApp** (item 05)
3. **Táxi dog com preço por região** (item 04)

## Fila do backlog

| # | Card | Prioridade | Esforço estimado |
|---|------|-----------|------------------|
| 01 | [Fila do dia — banho/tosa](01-fila-do-dia-banho-tosa.md) | 🔴 P0 — prioridade #1 dela | Alto |
| 02 | [Preço por porte/peso + raças](02-tabela-precos-porte-raca.md) | 🔴 P0 | Médio |
| 03 | [Venda/orçamento de serviços itemizado](03-venda-servicos-itemizado.md) | 🔴 P0 | Médio |
| 04 | [Táxi dog por região](04-taxi-dog-por-regiao.md) | 🟡 P1 — prioridade #3 dela | Médio |
| 05 | [WhatsApp — auxílio humano + aviso pet pronto](05-whatsapp-auxilio-humano.md) | 🟡 P1 — prioridade #2 dela | Alto |
| 06 | [Comissão dos tosadores (15%)](06-comissao-tosadores.md) | 🟢 P2 | Médio |
| 07 | [Estoque de mercadoria](07-estoque-mercadoria.md) | 🟢 P2 | Baixo-Médio |
| 08 | [Financeiro — contas a pagar + visão](08-financeiro.md) | 🟢 P2 | Médio |
| 09 | [Pacotes semanais](09-pacotes-semanais.md) | ⚪ P3 | Médio |
| 10 | [Expediente e horários](10-expediente-horarios.md) | ⚪ P3 | Baixo |
| 11 | [Consultório veterinário](11-consultorio-veterinario.md) | ⚪ P3 — escopo confirmado, depois do pet shop | Médio |

## O que já existe e será reaproveitado

Auth/papéis · clientes+pets (falta `weight`) · produtos+estoque (baixa automática) · pedidos+caixa+CSV · catálogo de serviços · módulo vet completo (consultas+receitas PDF) · cupons · auditoria · LGPD.

## Decisões de negócio confirmadas (não reabrir)

- **`appointments` (agendamento) é MANTIDO** por decisão do dono (Thiago), mesmo sem uso no banho/tosa — serve pro consultório a domicílio (único fluxo com horário) e uso futuro. A fila do dia (card 01) é entidade NOVA que coexiste, não substitui.
- Sem agendamento para banho/tosa — **ordem de chegada**
- Capacidade ~50 pets/dia (~32 sábado) — limite configurável
- Tosas exigem **validação humana** antes de fechar preço
- WhatsApp = **auxílio humano**, nunca bot autônomo
- Táxi dog **exclusivo** de quem faz banho/tosa
- Medicamentos = **venda livre** (sem receita)
- Comissão tosador = **15% do serviço**, rateio em dupla
- Horários: seg–sex 9–18 · sáb 8–16 · dom fechado
- Clientes mandam **muito áudio** no WhatsApp
