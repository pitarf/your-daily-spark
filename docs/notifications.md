# Entrega de notificações

O Marca Minha Vez mantém uma fila persistente na tabela `notifications`. Confirmações, cancelamentos e lembretes são criados pelo banco e permanecem com status `scheduled` até que um worker faça a entrega.

## Worker atual

O comando `bun run notifications:dispatch` processa as notificações vencidas em lotes e entrega e-mails usando a API transacional da Brevo. O worker:

1. busca notificações com status `scheduled` e `scheduled_at` menor ou igual ao momento atual;
2. tenta assumir cada item de forma atômica para evitar duas execuções processando o mesmo registro;
3. monta o conteúdo em português usando os dados do estabelecimento, cliente, profissional e atendimento;
4. envia o e-mail pela Brevo;
5. marca o registro como `sent` com `sent_at` quando a entrega termina;
6. marca como `failed` quando o cliente não tem e-mail ou o provedor rejeita o envio.

A implementação não adiciona segredos ao repositório. Configure apenas no ambiente de execução:

```text
BREVO_API_KEY=...
NOTIFICATION_FROM_EMAIL=rfpita.work@gmail.com
NOTIFICATION_FROM_NAME=Marca Minha Vez
```

O endereço `NOTIFICATION_FROM_EMAIL` deve estar cadastrado e autorizado como remetente na Brevo antes do envio real.

## Agendamento do worker

O processo é intencionalmente um comando separado do aplicativo. Isso permite executá-lo em um cron do provedor de hospedagem, um scheduler externo ou uma tarefa recorrente do ambiente de produção.

Exemplo a cada 5 minutos:

```text
bun run notifications:dispatch 25
```

O segundo argumento define o número máximo de notificações por execução, limitado internamente a 100.

## Teste seguro

A integração pode ser validada em modo sandbox da Brevo antes de fazer entregas reais. Nesse modo, a API confirma a requisição sem enviar o e-mail ao destinatário.

O dashboard também possui uma área de Integrações que verifica se os secrets estão configurados sem exibir seus valores e permite enviar um e-mail de teste para o e-mail da própria conta administrativa.

## Limitação atual

A entrega implementada nesta etapa é somente por e-mail via Brevo. WhatsApp oficial e SMS continuam como integrações futuras, sem alterar o formato da fila persistente.
