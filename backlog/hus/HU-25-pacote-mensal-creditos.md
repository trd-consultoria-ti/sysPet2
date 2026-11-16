# HU-25 — Pacote mensal e créditos do pet

**Card pai:** 09 · **Prioridade:** ⚪ P3

## Narrativa

Como **tutor recorrente**, quero comprar um pacote mensal (3 banhos + 1 tosa) pro meu pet e ir debitando a cada atendimento, para pagar menos e não me preocupar em agendar.

## Critérios de aceite

- Pacote por pet: composição (X banhos + 1 tosa higiênica OU baby), validade 1 mês, preço próprio
- Check-in mostra créditos restantes ("restam 2 banhos + 1 tosa")
- Atendimento consome crédito automaticamente quando pacote ativo
- Pacote acabou/expirou → volta a cobrar avulso ou tutor renova
- Alerta pro tutor quando pacote tá acabando (WhatsApp — HU-16)
- Painel de pacotes ativos (receita recorrente)

## Notas técnicas

- Nova entidade `packages` + `package_credits` (ou saldo JSONB)
- Depende de HU-01 (check-in) e HU-08 (preços) — integração no consumo
- Valores exatos pendentes com Thaina (foto ilegível ~R$90–110)
- Elegível hoje: raças pequenas (Shih-tzu, York, Lhasa, Maltês) até 10kg
