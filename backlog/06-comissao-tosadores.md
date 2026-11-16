# 06 — Comissão dos tosadores (15%)

**Prioridade:** P2 · Ela mesma fecha o financeiro manualmente

## Contexto e Motivação

> "15% do valor do serviço realizado por ele, se o serviço for realizado por 2 profissionais é dividido por 2"

Hoje: Thaina calcula tudo na mão — vendas, contas a pagar e comissão. Não existe nem cadastro de tosador no sistema (só `users` genéricos e `vets`).

## Narrativa

Cada atendimento de banho/tosa registra **quem executou** (1 ou 2 profissionais). No fechamento, o sistema calcula 15% do valor do serviço por executor; em dupla, rateia. A Thaina tem um relatório de comissões por período pra pagar.

## Critérios de aceite

- Cadastro de tosadores (nome, contato, ativo) — pode ou não ter login
- Check-in/atendimento marca executor(es) do serviço
- Comissão = 15% × valor do serviço × participação (100% solo / 50% cada em dupla — confirmar regra exata: divide o serviço ou a comissão)
- Relatório por período: tosador, atendimentos, base, comissão devida
- Comissão entra no financeiro como conta a pagar prevista (card 08)
- Histórico por pet/serviço pra auditoria

## Notas técnicas

- Nova entidade `groomers` (ou estender `users` role='groomer') + `service_staff`/`checkin_staff` N:N.
- Importante: comissão é sobre o **serviço**, não sobre extras/táxi — confirmar se luvinha/desembolo entram na base.
- Pendente com Thaina: rateio exato em dupla ("dividido por 2" — do valor ou da comissão? efeito prático igual se linear, mas documentar).
- Integrar com `cash_movements` tipo 'saida' na hora do pagamento efetivo.
