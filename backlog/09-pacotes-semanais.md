# 09 — Pacotes semanais (assinatura de banho/tosa)

**Prioridade:** P3 · Receita recorrente — vale explorar depois do MVP

## Contexto e Motivação

Da tabela oficial: "Semanal (até 10kg) — 1 mês: **3 banhos + 1 tosa higiênica OU 1 tosa baby**" para Shih-tzu, York, Lhasa, Maltês. É receita recorrente e fideliza — mas os valores na foto estavam incertos (OCR ~R$90–110).

## Narrativa

O tutor compra um pacote mensal pro pet: N banhos + 1 tosa no mês. O sistema controla os **créditos restantes** — a cada atendimento do dia (card 01), debita do pacote em vez de cobrar avulso. Acabou o pacote → volta a pagar avulso ou renova.

## Critérios de aceite

- Pacote por pet: composição (X banhos + 1 tosa), validade (1 mês), preço
- Saldo de créditos visível no check-in ("restam 2 banhos")
- Check-in consome crédito automaticamente quando pacote ativo
- Alerta de pacote acabando / expirando pro tutor
- Relatório de pacotes ativos (receita recorrente prevista)

## Notas técnicas

- Nova entidade `packages` + `package_credits` (ou saldo JSONB no pet).
- Depende dos cards 01 (check-in) e 02 (preços) estarem prontos.
- Pendente com Thaina: valores exatos dos pacotes (foto ilegível).
