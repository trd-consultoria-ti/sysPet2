# 09 — Pacotes semanais (assinatura de banho/tosa)

**Prioridade:** P3 · Receita recorrente — vale explorar depois do MVP

## Contexto e Motivação

Da tabela oficial: "Semanal (até 10kg) — 1 mês: **3 banhos + 1 tosa higiênica OU 1 tosa baby**" para Shih-tzu, York, Lhasa, Maltês. É receita recorrente e fideliza — mas os valores na foto estavam incertos (OCR ~R$90–110).

**Modelo confirmado por Thaina (~16:32):** pacote é **por pet** (uso exclusivo de um animal); o mês tem ~4 semanas e o tutor marca de antemão o(s) **dia(s) recorrente(s)** de atendimento (ex.: toda segunda). Não é uso livre — tem dia marcado.

## Narrativa

O tutor compra um pacote mensal pro pet: N banhos + 1 tosa no mês, vinculado a um dia da semana recorrente. O sistema controla os **créditos restantes** — a cada atendimento do dia (card 01), debita do pacote em vez de cobrar avulso. Acabou o pacote → volta a pagar avulso ou renova.

## Critérios de aceite

- Pacote por pet: composição (X banhos + 1 tosa), validade (1 mês), preço — **por pet confirmado**
- **Dia(s) recorrente(s) da semana** marcado(s) pelo tutor no pacote (ex.: toda segunda) — confirmado por Thaina
- Saldo de créditos visível no check-in ("restam 2 banhos")
- Check-in consome crédito automaticamente quando pacote ativo
- Alerta de pacote acabando / expirando pro tutor
- Relatório de pacotes ativos (receita recorrente prevista)

## Notas técnicas

- Nova entidade `packages` + `package_credits` (ou saldo JSONB no pet).
- Depende dos cards 01 (check-in) e 02 (preços) estarem prontos.
- Pendente com Thaina: valores exatos dos pacotes (foto ilegível).
- **Controle atual confirmado:** caderno de pacotes (manual) — o sistema elimina esse caderno.
