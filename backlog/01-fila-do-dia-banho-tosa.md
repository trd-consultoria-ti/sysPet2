# 01 — Fila do dia: banho e tosa (check-in → pronto → entregue)

**Prioridade:** P0 · **É a prioridade #1 declarada pela dona**

## Contexto e Motivação

Hoje a operação é 100% papel: caderno no balcão (pet, tutor, telefone, procedimento) + ficha solta presa no cachorro na gaiola. Dores reais dela:

- "A preocupação do tutor é que hora o animal vai sair da loja. O tutor não quer esperar, não quer que o animal fique muito tempo fora de casa. Preciso ser o mais dinâmica possível pra não ter atraso nem reclamação."
- Ficha se perde/descola; caderno único; sem histórico; equipe de tosa não sabe o que vem a seguir.
- Ela fecha o dia dizendo "nossas vagas encerraram" no feeling — sem número.

## Narrativa

A recepção faz **check-in** do pet (não agendamento): identifica tutor+pet, procedimento, cobra/confirma. O pet entra numa **fila do dia** ordenada. O sistema mostra posição ("3º da fila"), estima saída e avisa o tutor no WhatsApp quando fica pronto. Ao entregar, o atendimento fecha e vira venda.

**Regra central:** por ordem de chegada, sem horário marcado. Capacidade ~50/dia (sábado ~32) — configurável por dia da semana.

## Critérios de aceite

- Check-in cria registro do dia: tutor, pet, procedimento, observações de saúde, preço
- Fila visível em tempo real: posição, pets à frente/atrás, status (aguardando → em atendimento → pronto → entregue)
- ETA de saída por pet (baseado no tempo médio do serviço — ver pendência com Thaina)
- Limite diário de vagas configurável; ao atingir, sistema indica "encerrar" e WhatsApp pode responder "vagas encerradas"
- Status "pronto" dispara notificação WhatsApp pro tutor (ver card 05)
- Check-in inclui **checklist de saúde**: lesão de pele, parasitas, diarreia, vômito, mal-estar, lesão em pata → tutor informado + registro no histórico do pet
- **Tosas NUNCA fecham sozinhas**: orçamento fica "pendente de confirmação" até humano validar o serviço com o tutor
- Ao entregar: gera venda/orçamento (card 03) e registra quem executou (alimenta comissão — card 06)

## Notas técnicas

- **Modelo atual é incompatível para banho/tosa**: `appointments` exige data futura + horário (`minDate=amanhã`). Criar entidade nova (ex.: `daily_services` / `pet_checkins`) em vez de forçar appointments.
- **`appointments` é MANTIDO** (decisão do dono): não remover nem quebrar. Ele atende o consultório a domicílio (agendamento prévio) e uso futuro — a fila do dia convive lado a lado.
- Status sugerido: `aguardando → em_atendimento → pronto → entregue | cancelado` (+ `orçamento_pendente` para tosas)
- Campos: customer_id, pet_id, service composition (JSONB ou tabela filha), checkin_at, started_at, ready_at, delivered_at, groomer_ids[], health_flags JSONB, price_snapshot
- Índices por (date, status); unique parcial p/ 1 pet ativo por vez
- `pets` precisa `weight_kg`/`size_tier` (card 02)
