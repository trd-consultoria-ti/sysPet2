# 12 — Dados da empresa (identidade jurídica e contato)

**Prioridade:** P3 · Barato e destrava documentos profissionais

## Contexto e Motivação

Documentos oficiais recebidos de Thaina (16/11 ~18:43, originais em `OpenBot\Shared\animal-world-docs\`):

- **Razão social:** ANIMAL WORLD PET SHOP RIACHO FUNDO LTDA.
- **Nome fantasia:** ANIMAL WORLD PET SHOP
- **CNPJ:** 41.562.090/0001-91 (matriz, ativa desde 13/04/2021)
- **Inscrição Estadual (CF/DF):** 08.048.303/001-32
- **Porte:** Microempresa — sociedade empresária limitada (**não MEI**)
- **CNAE principal:** 96.09-2/08 (higiene/embelezamento de animais domésticos)
- **CNAEs secundários:** 47.63-6/01 (brinquedos) · 47.89-0/04 (animais vivos + artigos/alimentos pet)
- **Endereço:** QC 03 conjunto 01 lote 03 loja 06, Riacho Fundo II, Brasília-DF · **CEP:** 71.882-101
- **Telefone:** 61 9954-1097 · **E-mail:** animalworld.pet202@gmail.com
- **Licença RLE:** emitida 13/04/2021, atividades dispensadas pela Vigilância Sanitária DF
- **Regime (CF/DF 2021):** Regime Normal de Apuração ISS+ICMS — *pode ter migrado p/ Simples, confirmar se for emitir nota*

## Narrativa

O sistema gera documentos (receita veterinária em PDF, recibos, orçamentos) e mensagens de WhatsApp. Todos precisam sair com a identidade real da loja — nome fantasia, CNPJ, endereço e telefone — e não com textos fixos no código.

## Critérios de aceite

- Entidade/config única com os dados acima, editável pela dona
- Receita veterinária em PDF (módulo vet existente) sai com cabeçalho: nome fantasia, CNPJ, endereço, telefone
- Recibos/orçamentos (card 03) e fechamento de caixa (card 08) usam os mesmos dados
- Mensagens WhatsApp (card 05) podem citar endereço/telefone a partir do cadastro
- Rodapé LGPD/política identifica a empresa como controladora dos dados (razão social + CNPJ)

## Notas técnicas

- Tabela `business_profile` (1 linha) ou config: trade_name, legal_name, cnpj, ie (inscrição estadual), address_line, city, uf, cep, phone, email, cnae.
- Hoje `schema.sql` não tem nada disso — dados estariam hardcoded se não criar.
- ⚠️ Contrato social indica sócios — mesma regra de atenção do histórico TRD: não exibir nomes de sócios em documentos do sistema sem pedido explícito.
