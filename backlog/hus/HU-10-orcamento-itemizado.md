# HU-10 — Orçamento itemizado do atendimento

**Card pai:** 03 · **Prioridade:** 🔴 P0

## Narrativa

Como **recepção**, quero montar o orçamento do atendimento com itens separados (tosa + luvinha + táxi = total), para o tutor ver exatamente pelo que paga — igual já fazem hoje no WhatsApp.

## Critérios de aceite

- Orçamento lista cada item: descrição, qtd, valor unitário, subtotal
- Soma correta e total exibido (ex.: tosa baby 80 + luvinha 10 + táxi 10 = **100**)
- Itens: serviço principal, extras, táxi dog, produtos (ração vendida junto?)
- Orçamento fica vinculado ao check-in do dia e ao tutor
- Pode ser enviado ao tutor por WhatsApp como texto formatado (integra HU-16)
- Cupom/desconto opcional (reusar `coupons`)

## Notas técnicas

- `orders.items` JSONB hoje só guarda produtos — estender formato p/ `{type:'service'|'product'|'taxi', ref_id, name, price, qty}` OU entidade `service_orders` própria
- Decisão de modelagem afeta HU-11 (caixa) — preferir reusar orders p/ não duplicar cupom/caixa
- Snapshot de preço no orçamento (preço muda na tabela depois, orçamento antigo não pode mudar)
- Tela: drawer/modal no check-in ou página própria no dashboard
