# Checklist de produção

## Ambiente

- [ ] `GEMINI_API_KEY` configurada
- [ ] `BREVO_API_KEY` configurada
- [ ] `SUPABASE_SERVICE_ROLE_KEY` configurada somente no servidor
- [ ] `NOTIFICATION_SIGNING_SECRET` configurada
- [ ] `LOVABLE_CRON_SECRET` configurada no ambiente do aplicativo
- [ ] `LOVABLE_CRON_SECRET` configurada em GitHub Actions
- [ ] `PUBLIC_APP_URL` aponta para o domínio público correto
- [ ] `NOTIFICATION_FROM_EMAIL` é um remetente autorizado na Brevo
- [ ] `NOTIFICATION_FROM_NAME=Marca Minha Vez`

## Agenda

- [ ] Expediente geral revisado
- [ ] Intervalos revisados
- [ ] Exceções e feriados revisados
- [ ] Agenda individual dos profissionais revisada
- [ ] Bloqueios necessários cadastrados
- [ ] Serviços com duração e preço corretos
- [ ] Regras dos planos de clientes revisadas
- [ ] Duração personalizada ativada somente quando desejada

## Segurança

- [ ] Nenhum segredo presente em `.env`, commits, logs ou frontend
- [ ] Chaves antigas expostas foram revogadas
- [ ] RLS ativo e testado por estabelecimento
- [ ] Operações administrativas protegidas no servidor
- [ ] Links de gerenciamento usam assinatura e expiração
- [ ] Endpoint de scheduler protegido por secret

## Notificações

- [ ] E-mail de confirmação testado
- [ ] E-mail de cancelamento testado
- [ ] Lembrete de 24 horas testado
- [ ] Agendamento reagendado invalida o lembrete anterior
- [ ] Scheduler do GitHub Actions executa a cada 5 minutos
- [ ] Falhas de entrega aparecem no histórico da fila

## IA

- [ ] Assistente de configuração de expediente testado
- [ ] Perguntas de disponibilidade testadas
- [ ] Datas relativas respeitam o fuso do estabelecimento
- [ ] Serviço e profissional são resolvidos contra cadastros reais
- [ ] Horários retornados são provenientes do motor de disponibilidade
- [ ] Dados pessoais desnecessários não são enviados ao Gemini

## Autenticação

- [ ] Cadastro por e-mail testado
- [ ] Login testado
- [ ] Recuperação de senha testada
- [ ] Papel admin validado
- [ ] Papel professional validado
- [ ] Google Login habilitado somente quando configurado no provedor

## Antes do lançamento

- [ ] TypeScript passa
- [ ] ESLint passa
- [ ] Build de produção passa
- [ ] Agenda pública testada em celular e desktop
- [ ] Agendamento normal testado
- [ ] Agendamento personalizado testado
- [ ] Atendimento avulso testado
- [ ] Cancelamento e reagendamento testados
- [ ] Novo estabelecimento criado e isolado do estabelecimento demo
