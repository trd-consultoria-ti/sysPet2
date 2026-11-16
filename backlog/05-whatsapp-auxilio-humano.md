# 05 — WhatsApp: auxílio humano + aviso de pet pronto

**Prioridade:** P1 · Prioridade #2 declarada por ela · Dor original: "responder as mesmas perguntas"

## Contexto e Motivação

A dor #1 nas palavras dela: "a logística de responder as mesmas perguntas aos clientes, pelo WhatsApp". O fluxo padrão do cliente (confirmado com prints reais):

1. "quanto custa?" → precisa identificar porte/peso/raça do pet
2. "vocês buscam?" → precisa endereço + condomínio/bairro → preço do táxi por região
3. Combinado → ela avisa quando o pet está pronto / motorista sai

**Regra inviolável (ela foi explícita):** "não dá pro sistema responder sozinho — perguntas muito complexas, alguns clientes dificultam a identificação. Acho necessário um auxílio humano". → **Human-in-the-loop**: sistema sugere/minuta, humano aprova e envia. NUNCA bot autônomo.

Fato relevante: **"recebo muito áudio"** — clientes mandam voz com frequência.

## Narrativa

Duas frentes:

**A) Notificações automáticas (seguras, sem risco):** quando o pet muda pra "pronto" ou o motorista sai, o sistema dispara WhatsApp pro tutor com mensagem pronta. Ela já faz isso manualmente hoje.

**B) Auxílio ao atendente:** inbox das conversas dentro do sistema (ou painel ao lado) com **respostas sugeridas** baseadas no contexto: tabela de preços por porte, status da fila do pet do cliente, regiões de táxi, horário/vagas. O atendente edita/aprova e envia. Áudio: fase 2 com transcrição.

## Critérios de aceite

- Evento "pet pronto" → mensagem automática pro tutor (template com nome do pet)
- Evento "motorista a caminho" → mensagem automática (card 04)
- Sugestão de resposta contextual: cliente pergunta preço → sistema propõe cotação pelos dados do pet cadastrado
- Caixa de entrada WhatsApp integrada (via Evolution API) com ações rápidas: aprovar sugestão, inserir preço, avisar status
- Registro de mensagens vinculadas ao cliente/pet (histórico no cadastro)
- **Nenhuma mensagem sai sem ação humana** (exceto as notificações automáticas de status, que são transacionais)

## Notas técnicas

- Infra disponível: **Evolution API rodando local** (`127.0.0.1:8080`, instância `thiago-job-hunter` = número dela 61 99207-8335). Webhook de mensagens recebidas + envio.
- Cuidado: conta é WhatsApp comum não-oficial — risco de banimento em disparo massivo; volume aqui é baixo (1 loja), ok.
- Mensagens dela chegam por **LID** (`@lid`) além do JID de telefone — tratar os dois.
- Operador do auxílio humano: **recepcionista contratada** (confirmado por Thaina ~15:32 — não é a dona). Papel dela no sistema precisa existir antes desta tela fazer sentido.
- Áudio: MVP = atendente usa transcrição nativa do WhatsApp (grátis, PT-BR). Fase 2 = Whisper API p/ sugestão automática ler áudio.
- Compliance: mensagens transacionais (status) ok; marketing precisa opt-in (LGPD).
