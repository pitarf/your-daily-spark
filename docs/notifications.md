# Entrega de notificações

O Marca Minha Vez mantém uma fila persistente na tabela `notifications`. Confirmações, cancelamentos e lembretes são criados pelo banco e permanecem com status `scheduled` até que um worker faça a entrega.

## Worker atual

O comando `bun run notifications:dispatch` processa as notificações vencidas em lotes e entrega e-mails usando a API do Resend. O worker:

1. busca notificações com status `scheduled` e `scheduled_at` menor ou igual ao momento atual;
2. tenta assumir cada item de forma atômica para evitar duas execuções processando o mesmo registro;
3. monta o conteúdo em português usando os dados do estabelecimento, cliente, profissional e atendimento;
4. envia o e-mail;
5. marca o registro como `sent` com `sent_at` quando a entrega termina;
6. marca como `failed` quando o cliente não tem e-mail ou o provedor rejeita o envio.

A implementação não adiciona segredos ao repositório. São necessários apenas no ambiente de execução:

```text
RESEND_API_KEY=...
NOTIFICATION_FROM_EMAIL=contato@seu-dominio.com
NOTIFICATION_FROM_NAME=Marca Minha Vez
```

## Agendamento do worker

O processo é intencionalmente um comando separado do aplicativo. Isso permite executá-lo em um cron do provedor de hospedagem, um scheduler externo ou uma tarefa recorrente do ambiente de produção.

Exemplo a cada 5 minutos:

```text
bun run notifications:dispatch 25
```

O segundo argumento define o número máximo de notificações por execução, limitado internamente a 100.

## Limitação atual

A entrega implementada nesta etapa é somente por e-mail via Resend. WhatsApp oficial e SMS continuam como integrações futuras, sem alterar o formato da fila persistente.
