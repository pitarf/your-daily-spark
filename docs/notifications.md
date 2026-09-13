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

## Endpoint HTTP para scheduler externo

Em produção a fila também pode ser processada por HTTP, sem execução manual:

```text
POST https://project--a302acfa-e5c7-4e7b-bd53-63f8d1ece480.lovable.app/api/public/hooks/dispatch-notifications?limit=25
x-cron-secret: <valor de NOTIFICATIONS_CRON_SECRET>
```

Regras da rota:

- exige o header `x-cron-secret` (ou `Authorization: Bearer <secret>`) com o valor de `NOTIFICATIONS_CRON_SECRET`, comparado em tempo constante no servidor;
- sem o header correto, responde `401 {"error":"unauthorized"}` e não toca na fila;
- em sucesso responde apenas o resumo `{"ok":true,"processed":n,"sent":n,"failed":n,"skipped":n}`, sem dados de clientes;
- em falha responde `500` com uma mensagem já higienizada, nunca com credenciais;
- `limit` é opcional, padrão 25 e teto 100.

Exemplo de chamada por um scheduler externo (cron-job.org, GitHub Actions, cron do provedor):

```bash
curl -fsS -X POST \
  -H "x-cron-secret: $NOTIFICATIONS_CRON_SECRET" \
  "https://project--a302acfa-e5c7-4e7b-bd53-63f8d1ece480.lovable.app/api/public/hooks/dispatch-notifications?limit=25"
```

Intervalo recomendado: a cada 5 minutos. O comando `bun run notifications:dispatch` continua funcionando e usa exatamente a mesma rotina.

## Teste seguro

A integração pode ser validada em modo sandbox da Brevo antes de fazer entregas reais. Nesse modo, a API confirma a requisição sem enviar o e-mail ao destinatário.

O dashboard também possui uma área de Integrações que verifica se os secrets estão configurados sem exibir seus valores e permite enviar um e-mail de teste para o e-mail da própria conta administrativa.

## Limitação atual

A entrega implementada nesta etapa é somente por e-mail via Brevo. WhatsApp oficial e SMS continuam como integrações futuras, sem alterar o formato da fila persistente.

## Scheduler automático no GitHub Actions

O repositório já inclui `.github/workflows/notifications-cron.yml`, que roda a cada 5 minutos (e também pode ser disparado manualmente) e faz `POST` para o endpoint de produção com o header `x-cron-secret`. O workflow falha quando a resposta não for 2xx e registra somente o resumo seguro (`processed`, `sent`, `failed`, `skipped`). Nenhuma chave aparece no YAML.

Único passo manual: cadastrar o secret `NOTIFICATIONS_CRON_SECRET` em **Settings → Secrets and variables → Actions** do repositório GitHub, com exatamente o mesmo valor usado no ambiente de produção. Sem esse secret o workflow falha logo no início com uma mensagem explícita.
