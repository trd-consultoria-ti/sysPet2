# HU-19 — Executor no atendimento + relatório de comissão

**Card pai:** 06 · **Prioridade:** 🟢 P2

## Narrativa

Como **dona**, quero marcar quem fez cada serviço e ver a comissão de 15% por tosador, para fechar o pagamento sem fazer conta na mão.

## Critérios de aceite

- Atendimento registra executor(es): 1 tosador ou 2 em dupla
- Comissão = **15% do valor do serviço** por executor; em dupla, rateia (confirmar: divide serviço ou comissão — efeito igual se linear)
- Base de cálculo = valor do serviço (não total da conta — confirmar se extras/luninha entram)
- Relatório por período: tosador → atendimentos → base → comissão devida
- Comissões aparecem como contas a pagar previstas (HU-23)
- Ao pagar, marcar como pago e gerar saída no caixa

## Notas técnicas

- `checkin_staff`/`service_staff` N:N (checkin ↔ groomer) ou campo no item do orçamento
- Regra de rateio: se 2 executores, cada um 7,5% OU dividem 15% — documentar decisão
- Cálculo em cima do `service` items do orçamento (HU-10), excluindo táxi/produtos provavelmente
- Fechamento mensal/semanal — ela escolhe período
- Depende de HU-18 (cadastro) e HU-10/11 (valor do serviço)
