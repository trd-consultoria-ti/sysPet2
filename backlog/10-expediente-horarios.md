# 10 — Expediente e horários de funcionamento

**Prioridade:** P3 · Simples mas necessário pra fila do dia

## Contexto e Motivação

Confirmado: **seg–sex 9h–18h · sáb 8h–16h · dom fechado** (ela respondeu "recepcionista 9 às 18 seg a sexta, sábado 8 às 16" — domingo inferido fechado, tabela diz "segunda a sábado").

## Narrativa

O sistema precisa saber o expediente pra: limitar o dia de atendimento, calcular vagas por dia (sábado tem limite menor — ~32 vs ~50), e responder no WhatsApp "estamos fechados/abrimos às X".

## Critérios de aceite

- Configuração de expediente por dia da semana (abre/fecha, folga no meio se houver)
- Fila do dia (card 01) respeita expediente: não recebe check-in fora do horário
- Limite de vagas por tipo de dia (útil p/ sábado menor)
- Status "aberto/fechado" visível no painel e usável nas respostas WhatsApp (card 05)

## Notas técnicas

- Tabela/config `business_hours` (day_of_week, open_time, close_time, daily_capacity).
- Capacidade já está no card 01 — aqui é só o horário; podem ser o mesmo card de configuração.
- Domingo: confirmar explicitamente com Thaina (nunca respondeu direto).
