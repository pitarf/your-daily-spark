# Status do Projeto

## Funcionalidades Concluídas ✅

### Agenda e disponibilidade
- Banco multi-tenant PostgreSQL/Supabase com RLS e isolamento por estabelecimento.
- Proteção contra horários sobrepostos e conflitos com bloqueios.
- Motor de disponibilidade com fuso, expediente, intervalos, folgas, exceções, bloqueios, duração e agenda individual por profissional.
- Precedência determinística das exceções: fechamento individual > horário especial individual > fechamento geral > horário especial geral > agenda semanal.
- Agendamento público normal, personalizado e avulso.
- Escolha de profissional ou "qualquer profissional".
- Duração de 15 minutos a 4 horas em múltiplos de 15 quando habilitada.
- Regras de planos de clientes aplicadas no agendamento.
- Agendamento manual pelo administrador.
- Agenda administrativa Dia, Semana e Mês.
- Bloqueios e gestão de status.
- Busca e filtros de agenda administrativa por cliente, telefone, serviço, status e profissional.

### Cliente
- Cadastro e login por e-mail.
- Recuperação de senha.
- Busca pública de agendamentos por telefone e data.
- Página segura de gerenciamento por token assinado e expirável.
- Cancelamento e reagendamento públicos com nova validação server-side.
- Link de gerenciamento após a confirmação.
- Links de gerenciamento também nos e-mails de confirmação e lembrete.
- Exportação do agendamento em `.ics`.
- Rotação de segredo de assinatura: novos links usam `NOTIFICATION_SIGNING_SECRET` quando configurado e tokens legados continuam verificáveis durante a transição.
- Busca e filtros de clientes por nome, telefone, e-mail e plano.

### Estabelecimento e equipe
- Onboarding.
- Múltiplos estabelecimentos por conta administrativa.
- Gestão de serviços, profissionais, clientes e planos.
- Agenda individual por profissional.
- Gestão de equipe e permissões.
- Perfil, contato, logo e identidade do estabelecimento.
- Presets visuais adaptativos por tipo de negócio.
- Compartilhamento da agenda pública.
- Resumo semanal no dashboard.

### IA
- Assistente de configuração de expediente com Gemini.
- Consultas operacionais somente leitura.
- Consulta de disponibilidade real em linguagem natural.
- Serviço e profissional resolvidos contra cadastros reais.
- Horários retornados exclusivamente pelo motor real de disponibilidade.
- Atalhos diretos para a agenda a partir de respostas da IA.
- PII de clientes não é enviado ao Gemini.
- Autorização server-side dentro das funções de IA.

### Notificações
- Fila persistente de notificações.
- Confirmação, cancelamento e lembrete de 24 horas.
- Invalidação/recriação de lembretes após cancelamento ou reagendamento.
- Worker independente com `bun run notifications:dispatch`.
- Entrega por e-mail via Brevo.
- Endpoint HTTP protegido para scheduler.
- GitHub Actions executando a fila a cada 5 minutos.
- Workflow com retry e validação do resumo de processamento.
- O endpoint do scheduler aceita somente `POST`.
- Smoke test de produção verifica homepage e proteção do scheduler.

### SEO, segurança e operação
- Canonical URL por agenda pública.
- Metadados Open Graph e Twitter para compartilhamento.
- `robots=index,follow` nas agendas públicas.
- `SECURITY.md` com política de secrets e resposta a incidentes.
- `docs/production-checklist.md` para preparação de produção.
- Dependabot para atualizações semanais.
- Nenhum valor de secret deve ser versionado.

### Qualidade e documentação
- CI com TypeScript, ESLint e build de produção.
- `CHANGELOG.md` mantido como histórico permanente e append-only.
- `README.md` atualizado para o produto Marca Minha Vez.
- `docs/notifications.md` documenta Brevo, scheduler e rotação do segredo de gerenciamento.

## Em Desenvolvimento 🟡
- Refinamentos finais de UX em desktop e mobile.
- Personalização visual avançada por cores e layout.
- Testes end-to-end completos no ambiente publicado.
- Domínio personalizado por estabelecimento.
- Relatórios e métricas mais completos.

## Pendente 🔴
- Habilitar o provedor Google no ambiente de autenticação.
- WhatsApp oficial.
- SMS.
- Pagamentos e assinaturas SaaS.
- Limites comerciais por plano SaaS.
- Revogar/invalidar qualquer chave antiga da Brevo exposta no histórico, caso ainda não tenha sido feita.

## Configurado no ambiente

- `GEMINI_API_KEY`
- `BREVO_API_KEY`
- `LOVABLE_CRON_SECRET`

O código nunca deve conter os valores dessas variáveis.

## Segurança conhecida

O repositório teve um alerta público de token antigo da Brevo no histórico Git. A chave antiga deve permanecer revogada. A remoção do arquivo atual, sozinha, não remove o segredo do histórico.

---
*Última atualização: 2026-09-13*
