# 11 — Consultório veterinário

**Prioridade:** P3 · Escopo CONFIRMADO mas ela pediu foco no pet shop primeiro

## Contexto e Motivação

> "Tem sim [consultório], fixo na casa. Atendimento por ordem de chegada tbm"

Tem veterinário fixo. Serviços: **consulta e vacina** (outros não confirmados). Duas modalidades:
- **Presencial:** ordem de chegada (igual banho/tosa — mesma fila?)
- **Domicílio:** existe, mas **com agendamento prévio** — único fluxo com horário do negócio

Histórico do pet **necessário** (vacinas, consultas, receitas). Preços: ela vai mandar a tabela depois.

## O que já existe (boa notícia)

Módulo vet completo: `vets` (com CRMV), `consultations` (pet, data, diagnóstico, peso, temp, status agendado→em_atendimento→concluido), `prescriptions` + itens + **PDF**, telas admin próprias.

## Gaps a resolver quando chegar a vez

- Presencial é walk-in mas `consultations` exige `scheduled_date`+`scheduled_time` — precisa aceitar "ordem de chegada" (fila) ou adaptar
- **Domicílio com agendamento prévio: `appointments`/`consultations` já comportam** — e o dono decidiu MANTER o módulo de agendamento mesmo sem uso no banho/tosa. É aqui que ele ganha uso real.
- Vacinas: hoje só texto em `reason`/`notes` — decidir se vira entidade própria (vacina, lote, próxima dose = retorno)
- Domicílio: `consultations` já tem data/hora — cabe; falta campo endereço/local + deslocamento
- Preços do consultório: cadastrar quando ela mandar
- Checklist de saúde do banho/tosa vale pro consultório? (pergunta pendente)
- Comissão do veterinário existe? (não perguntado)

## Notas técnicas

- Reusar módulo existente é o caminho — ajustes de modelo, não reescrita.
- Se a fila do dia (card 01) for genérica o suficiente, consultório pode entrar na mesma esteira com tipo de atendimento diferente.
- Receituário: `prescriptions` já emite PDF — medicamentos veterinários provavelmente COM receita (diferente da venda livre de balcão).
