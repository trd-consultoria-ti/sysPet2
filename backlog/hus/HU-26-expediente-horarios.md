# HU-26 — Horários e capacidade por dia da semana

**Card pai:** 10 · **Prioridade:** ⚪ P3

## Narrativa

Como **dona**, quero configurar o horário de funcionamento e a capacidade de cada dia da semana, para o sistema saber quando abrir/fechar e quantas vagas cada dia tem.

## Critérios de aceite

- Configuração por dia: seg–sex 9h–18h · sáb 8h–16h · dom fechado
- Capacidade por dia: ~50 em dia cheio, ~32 sábado (configurável)
- Check-in bloqueado fora do expediente ("estamos fechados, abrimos às X")
- WhatsApp pode informar horário de funcionamento nas respostas (HU-16)
- Feriados/exceções pontuais (avaliar depois)

## Notas técnicas

- Entidade `business_hours` (day_of_week, open_time, close_time, daily_capacity, active)
- Alimenta HU-04 (vagas) e HU-01 (check-in fora do horário)
- Domingo fechado = `active=false` ou capacity=0
- Simples mas destrava várias regras — fazer cedo junto com o card 01
