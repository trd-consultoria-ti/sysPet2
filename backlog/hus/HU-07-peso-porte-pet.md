# HU-07 — Peso/porte do pet

**Card pai:** 02 · **Prioridade:** 🔴 P0

## Narrativa

Como **recepção**, quero registrar o peso do pet no cadastro, para que o sistema calcule o preço correto do banho/tosa (que depende do porte).

## Critérios de aceite

- Cadastro/edição de pet tem campo **peso (kg)** — obrigatório pra cotar banho/tosa
- Peso define faixa de porte automaticamente: pequeno 1–10kg · médio 10–15 · médio/grande 15–20 · grande 20–40
- Peso pode ser atualizado (pet emagrece/engorda muda o preço)
- Pet sem peso: sistema avisa "informe o peso pra calcular o preço" no check-in
- Histórico de peso opcional (útil pro consultório)

## Notas técnicas

- `pets` hoje: name/type/breed/age/image — adicionar `weight_kg NUMERIC(6,2)`
- `size_tier` pode ser derivado (função) ou coluna — derivar evita dessincronia
- Form do pet (`petForm` em appointments.component) ganha campo weight
- Consultations já tem `weight` — aproveitar padrão
