# HU-16 — Sugestões de resposta pro atendente

**Card pai:** 05 · **Prioridade:** 🟡 P1 · **Núcleo da dor dela**

## Narrativa

Como **atendente**, quero que o sistema sugira a resposta certa pras perguntas repetidas (preço, busca, horário), para responder em segundos em vez de digitar tudo — sempre com minha aprovação antes de enviar.

## Critérios de aceite

- Cliente pergunta preço → sistema sugere cotação usando dados do pet (peso/porte → HU-08) e serviços
- Cliente pergunta busca/endereço → sistema guia coleta de endereço + condomínio → resolve região → preço do táxi (HU-12)
- Sugestão aparece pro atendente revisar/editar; **nada envia sozinho**
- Sugestões usam os textos-modelo reais observados ("Temos vaga sim, está R$50!", "Qual seu endereço?", "Qual é o condomínio?")
- Contexto do cliente (pet cadastrado, atendimentos anteriores) alimenta a sugestão
- Áudio: atendente usa transcrição nativa do WhatsApp no MVP; fase 2 = sistema transcreve (Whisper)

## Notas técnicas

- Evolution API: webhook de msgs recebidas → classifica intenção (preço/busca/status/saudação) → gera sugestão → exibe no painel do atendente
- Classificação MVP pode ser por palavras-chave/regras — sem LLM obrigatório no início
- Painel: lista de conversas + sugestão + botões aprovar/editar/ignorar
- Registrar par pergunta→resposta aprovada p/ melhorar sugestões
- LGPD: mensagens de clientes são dados pessoais — guardar mínimo necessário, política de retenção
