# HU-06 — Confirmação humana de tosas

**Card pai:** 01 · **Prioridade:** 🔴 P0

## Narrativa

Como **dona**, quero que tosa NUNCA feche sozinha — o sistema sugere, uma pessoa confirma com o tutor — porque é difícil identificar o que o tutor quer fazer no animal.

## Critérios de aceite

- Ao cotar tosa (higiênica/geral/baby), orçamento fica com status `pendente_confirmacao`
- Atendente vê a sugestão do sistema e confirma/ajusta com o tutor antes de fechar
- Fluxo de confirmação registrado (quem confirmou, quando, o que foi fechado)
- Banho simples pode fechar direto (regra dela: tosas exigem confirmação; banho é mais direto — validar se banho também quer confirmação)
- Nenhum valor de tosa é cobrado/finalizado sem confirmação humana

## Notas técnicas

- Status adicional no check-in/orçamento: `orçamento_pendente → confirmado`
- Badge visual no quadro da fila (HU-02) pra tosas aguardando confirmação
- Integra com HU-10 (orçamento itemizado): itens de tosa nascem pendentes
- Regra configurável por tipo de serviço (banho auto-confirma? tosas sempre pedem?)
