# 03 — Venda/orçamento de serviços itemizado

**Prioridade:** P0 · Hoje o sistema NÃO vende serviço

## Contexto e Motivação

O padrão real de fechamento (print da conversa real):

```
Tosa bebê alta ......... R$80,00
Luvinha ................ R$10,00
Táxi dog ............... R$10,00
Total .................. R$100,00
```

`orders` hoje **só aceita produtos** (`products` table lookup) — banho, tosa, táxi e extras não podem ser vendidos, não geram `cash_movement`, não aparecem no financeiro.

## Narrativa

O fechamento do atendimento do dia (card 01) gera uma **venda de serviços**: itens = serviço principal + extras + táxi dog, cada um com preço calculado (card 02/04). A venda entra no caixa como as vendas de produto já entram. Desconto/cupom pode se aplicar.

## Critérios de aceite

- Pedido aceita itens de serviço (não só produto): tipo, referência, descrição, qtd, preço unitário, total
- Orçamento itemizado persistido: cada linha visível pro tutor/financeiro
- Gera `cash_mov movements` entrada no pagamento (reusar fluxo de orders)
- Status do pedido reflete o atendimento: `aguardando → em atendimento → pronto → entregue/pago`
- Relatório do dia: total em serviços vs produtos vs táxi

## Notas técnicas

- Opção A: estender `orders.items` JSONB p/ aceitar `{type:'service',...}` — menor mudança, orders já tem cupom/caixa.
- Opção B: entidade `service_sales` separada vinculada ao check-in — mais limpo pro financeiro, mais trabalho.
- Decidir: serviço pode ser vendido sem check-in (ex.: só extras no balcão)? Provável que sim.
- Atenção: `orders` tem `payment_method`, `status` (pendente/pago/entregue) — mapear pra realidade do pet shop.
- **Pagamento confirmado por Thaina:** sempre **após o procedimento**, meios = dinheiro, cartão ou pix. Sem cobrança prévia, sem fiado — fecha no balcão na retirada.
