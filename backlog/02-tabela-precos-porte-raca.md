# 02 — Tabela de preços por porte/peso + raças especiais

**Prioridade:** P0 · Base pra cotação no WhatsApp e no balcão

## Contexto e Motivação

A dor original dela: "responder as mesmas perguntas no WhatsApp" — quase sempre é **preço**. A tabela 2026 real (foto oficial) é uma matriz, não preço único:

| Porte | Banho | Tosa higiênica | Tosa geral | Tosa baby | Luvinha |
|---|---|---|---|---|---|
| Pequeno 1–10kg | 50 | 60 | 70 | 80 | +10 |
| Médio 10–15kg | 75 | 90 | 110 | ? | |
| Médio/grande 15–20kg | 110 | 130 | 160 | ? | |
| Grande 20–40kg | 140 | 170 | 210 | ? | |

**Raças com preço próprio:** Spitz (60/70/90) · ChowChow (150/190/210) · Husky/Akita (140/160/200)
**Extras:** desembolo 40–60 · unhas 15 · ouvido 20 · escovação 25
**Pacotes:** 3 banhos + 1 tosa/mês p/ raças pequenas (Shih-tzu, York, Lhasa, Maltês)

## Narrativa

Todo pet precisa ter **peso (kg)** no cadastro — é o que define o porte. O sistema calcula o preço do serviço pela matriz; raças especiais sobrescrevem o preço do porte. Extras somam. Pacotes semanais são vendidos como crédito mensal por pet.

## Critérios de aceite

- `pets.weight_kg` (ou porte manual) obrigatório pra cotar banho/tosa
- Motor de preço: serviço + porte → valor; raça especial → override; extras → soma
- Tabela editável pelo admin (ela muda preço sem chamar dev)
- Cotação retorna itemização (ex.: tosa baby 80 + luvinha 10 + táxi 10 = 100)
- Raças especiais e faixas de peso configuráveis

## Notas técnicas

- `pets` hoje: name/type/breed/age/image — **sem peso**. Adicionar `weight_kg NUMERIC` + `size_tier` derivado ou manual.
- Substituir preço flat de `catalog_services` por `price_rules` (service × size_tier × breed_override) ou JSONB de matriz no serviço.
- Pendências com Thaina: valores de tosa baby p/ portes médios/grandes (OCR incerto), valores exatos dos pacotes.
- Catálogo público (`GET /api/services`) deve expor a matriz pra futura vitrine/WhatsApp.
