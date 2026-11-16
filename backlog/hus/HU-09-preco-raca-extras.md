# HU-09 — Preço por raça especial e extras

**Card pai:** 02 · **Prioridade:** 🔴 P0

## Narrativa

Como **atendente**, quero que raças com preço diferenciado e serviços extras somem certo no orçamento, para não errar valor na frente do cliente.

## Critérios de aceite

- **Raças com preço próprio** (sobrescrevem o porte): Spitz 60/70/90 · ChowChow 150/190/210 · Husky/Akita 140/160/200
- **Extras somáveis**: luvinha +10 · desembolo 40–60 · unhas 15 · ouvido 20 · escovação 25 · hidratação ?
- Raça especial cadastrável/editável (não hardcoded)
- Orçamento mostra itemização: serviço base + extras + táxi = total (ex.: 80+10+10=100)
- Dúvida de tosa ("cortar rosto e pezinho") → sistema sugere, humano confirma (HU-06)

## Notas técnicas

- `breed_price_overrides(service_id, breed_pattern, price)` ou flag no price_rules
- Matching de raça: exata ou por lista de raças por tier de preço (Spitz-like, giant-breed etc.) — decidir granularidade
- Extras como `catalog_services` próprios com `is_extra=true`, somados no orçamento
- Pacotes semanais (HU-25) são outro mecanismo — não confundir com extras
