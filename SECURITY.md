# Segurança

## Segredos e chaves

Nenhuma chave de API deve ser armazenada no repositório, em arquivos `.env` versionados ou no código enviado ao navegador.

Arquivos de ambiente locais devem permanecer fora do Git. O repositório usa `.gitignore` para bloquear `.env` e `.env.*`, mantendo somente `.env.example` como referência não sensível.

As integrações usam variáveis de ambiente:

- `GEMINI_API_KEY`
- `BREVO_API_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NOTIFICATION_SIGNING_SECRET`
- `LOVABLE_CRON_SECRET`

O arquivo `.env.example` deve conter somente nomes de variáveis e valores vazios ou defaults não sensíveis.

## Gemini

O Gemini é usado como camada de interpretação e consulta. O motor de agenda continua sendo a fonte de verdade para disponibilidade.

Não enviar ao modelo dados desnecessários de clientes, como telefone ou e-mail. Consultas administrativas devem permanecer protegidas por autorização server-side.

## Brevo

O envio de e-mail acontece somente no servidor. A chave `BREVO_API_KEY` nunca deve ser enviada ao cliente.

O remetente atual de desenvolvimento é `rfpita.work@gmail.com` e precisa permanecer autorizado na conta Brevo antes de uso em produção.

## Links de gerenciamento

Links de gerenciamento de agendamento usam tokens assinados e com expiração. O segredo de assinatura nunca é exposto ao navegador.

Se um segredo de assinatura precisar ser rotacionado, os links emitidos antes da rotação podem deixar de funcionar, dependendo da estratégia de compatibilidade adotada.

## Scheduler

O endpoint de processamento da fila exige `LOVABLE_CRON_SECRET` no header `x-cron-secret` ou como Bearer token. O workflow do GitHub Actions lê o valor exclusivamente de GitHub Secrets.

O endpoint deve aceitar somente `POST`. Não deve processar a fila por acesso de navegador ou `GET`.

## Incidentes

Quando uma chave for exposta:

1. revogar a chave no provedor imediatamente;
2. criar uma substituta;
3. atualizar somente os Secrets do ambiente;
4. verificar logs e uso/billing do provedor;
5. registrar a correção no `CHANGELOG.md`.

Apagar somente o arquivo atual não remove um segredo do histórico Git. Segredos expostos no histórico devem ser considerados comprometidos.

## Multi-tenant

Toda leitura ou escrita de dados de negócio deve respeitar `establishment_id`. RLS e validações server-side devem continuar sendo camadas complementares, não substitutas.
