# HU-30 — Cadastro dos dados da empresa

**Card pai:** 12 · **Prioridade:** ⚪ P3

## Narrativa

Como **dona**, quero que os documentos e mensagens do sistema saiam com os dados reais da loja (nome fantasia, CNPJ, endereço, telefone), para parecerem profissionais e corretos sem eu precisar pedir pro programador.

## Critérios de aceite

- Tela/config onde a dona edita: nome fantasia, razão social, CNPJ, IE, endereço, telefone, e-mail
- Receita de veterinário em PDF sai com cabeçalho da empresa (nome fantasia, CNPJ, endereço, telefone)
- Orçamento/recibo de serviço (HU-10/11) usa os mesmos dados
- Mensagens automáticas (HU-14/16) podem incluir endereço e telefone da loja
- Valores iniciais já vêm preenchidos com os dados oficiais recebidos (ver card 12)

## Notas técnicas

- `business_profile` (1 linha): trade_name, legal_name, cnpj, ie, address_line, city, uf, cep, phone, email
- Sem multi-tenant — uma loja só; edição restrita a admin/dona
- Não exibir dados de sócios do contrato social em nenhum documento
