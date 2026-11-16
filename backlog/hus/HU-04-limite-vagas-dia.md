# HU-04 — Limite de vagas por dia

**Card pai:** 01 · **Prioridade:** 🔴 P0

## Narrativa

Como **dona**, quero que o sistema controle o máximo de pets por dia (~50, sábado ~32), para saber quando "as vagas encerraram" sem depender do feeling — e poder avisar o cliente na hora.

## Critérios de aceite

- Limite diário configurável por dia da semana (seg–sex ~50, sáb ~32)
- Check-in bloqueia/alerta quando limite atingido ("vagas do dia encerradas")
- Painel mostra vagas restantes do dia
- WhatsApp pode responder automaticamente "encerramos as vagas de hoje" quando cheio (HU-16)
- Cancelamento/liberação de vaga devolve a vaga pro dia

## Notas técnicas

- Config em `business_hours`/`daily_config` (junto com HU-26 expediente)
- Regra: count de checkins ativos do dia < capacity
- Edge: pet que falta (no-show) — precisa fluxo de "não veio" pra liberar vaga (avaliar depois)
