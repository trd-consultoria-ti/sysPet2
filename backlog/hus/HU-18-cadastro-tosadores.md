# HU-18 — Cadastro de tosadores

**Card pai:** 06 · **Prioridade:** 🟢 P2

## Narrativa

Como **dona**, quero cadastrar os tosadores que trabalham na loja, para atribuir atendimentos e calcular a comissão de cada um.

## Critérios de aceite

- CRUD de tosadores: nome, telefone, ativo/inativo (não precisa de login próprio no MVP — pode ser cadastro simples)
- Tosador pode existir sem usuário de sistema (diferente de `users`) — ou ser user com role específica
- Vínculo opcional com user (se um dia o tosador usar o sistema)
- Lista usada no check-in/atendimento pra marcar executor (HU-19)

## Notas técnicas

- Nova entidade `groomers` (name, phone, active, user_id NULL) — espelha padrão de `vets` (que já tem user_id nullable)
- Alternativa: role `groomer` em `users` — mas tosador pode não ter acesso ao sistema; entidade própria é mais flexível
- Reusar padrão `vets` como referência de modelagem
