# Entrega de notificações

O Marca Minha Vez mantém uma fila persistente na tabela `notifications`. Confirmações, cancelamentos e lembretes são criados pelo banco e permanecem com status `scheduled` até que um worker faça a entrega.

## Worker atual

O comando `bun run notifications:dispatch` processa as notificações vencidas em lotes e entrega e-mails usando a API transacional da Brevo. O worker:

1. busca notificações com status `scheduled` e `scheduled_at` menor ou igual ao momento atual;
2. tenta assumir cada item de forma atômica para evitar duas execuções processando o mesmo registro;
3. monta o conteúdo em português usando somente os dados necessários para o e-mail;
4. envia o e-mail pela Brevo;
5. marca o registro como `sent` com `sent_at` quando a entrega termina;
6. marca como `failed` quando o cliente não tem e-mail ou o provedor rejeita o envio.

A implementação não adiciona segredos ao repositório. Configure apenas no ambiente de execução:

```text
BREVO_API_KEY=...
NOTIFICATION_FROM_EMAIL=rfpita.work@gmail.com
NOTIFICATION_FROM_NAME=Marca Minha Vez
NOTIFICATION_SIGNING_SECRET=...
```

`NOTIFICATION_SIGNING_SECRET` é o segredo preferencial para assinar os links de gerenciamento de agendamento. Durante a rotação, a aplicação ainda aceita tokens legados assinados com `SUPABASE_SERVICE_ROLE_KEY` para não invalidar links já emitidos. Novos links passam a usar o segredo dedicado quando ele estiver configurado.

O endereço `NOTIFICATION_FROM_EMAIL` deve estar cadastrado e autorizado como remetente na Brevo antes do envio real.

## Endpoint HTTP para scheduler

A fila também pode ser processada por HTTP:

```text
POST https://marca-minha-vez.lovable.app/api/public/hooks/dispatch-notifications?limit=25
x-cron-secret: <valor de LOVABLE_CRON_SECRET>
```

Regras da rota:

- exige `x-cron-secret` ou `Authorization: Bearer <secret>`;
- compara o secret de forma resistente a comparação por tempo variável;
- aceita apenas chamadas `POST`;
- sem o valor correto, responde `401` e não toca na fila;
- em sucesso responde apenas `processed`, `sent`, `failed` e `skipped`;
- em falha responde mensagem higienizada, sem credenciais;
- `limit` é opcional, padrão 25 e teto 100.

## GitHub Actions

O repositório possui `.github/workflows/notifications-cron.yml`, que executa a cada 5 minutos e chama o endpoint em produção.

O workflow usa o secret:

```text
LOVABLE_CRON_SECRET
```

O mesmo valor deve existir no ambiente do aplicativo e em **GitHub → Settings → Secrets and variables → Actions**.

O workflow valida a resposta JSON e considera erro uma execução que reporte qualquer notificação com falha de entrega. A requisição usa retry para falhas transitórias de conexão.

## Teste seguro

O dashboard possui a área de Integrações, que verifica se Gemini e Brevo estão configurados sem revelar os valores e permite enviar um e-mail de teste para a própria conta administrativa.

## Tipos de notificação

O fluxo atual cobre:

- confirmação de agendamento;
- cancelamento;
- lembrete de 24 horas;
- links seguros para gerenciamento em confirmação e lembrete.

## Limitação atual

A entrega implementada nesta etapa é por e-mail via Brevo. WhatsApp oficial e SMS continuam como integrações futuras, sem alterar o formato da fila persistente.
