# Marca Minha Vez

Plataforma multi-tenant de agendamento online para negócios baseados em horário, como barbearias, salões, nail designers, estética, clínicas, consultórios, estúdios e serviços em geral.

## O que o sistema já faz

- Agenda pública por estabelecimento em `/agenda/{slug}`.
- Escolha de serviço, profissional ou "qualquer profissional", data e horário.
- Cálculo de disponibilidade respeitando expediente, intervalos, folgas, exceções, bloqueios, duração do serviço e agendamentos existentes.
- Agendamento real com validação no servidor e proteção contra conflito de horários.
- Agendamento manual pelo painel administrativo.
- Atendimentos avulsos, sem serviço pré-cadastrado, com título, duração e preço opcionais.
- Duração personalizada de 15 minutos a 4 horas, em múltiplos de 15, quando habilitada.
- Planos de clientes com limite de duração e serviços permitidos.
- Agenda administrativa em visões Dia, Semana e Mês.
- Gestão de serviços, profissionais, clientes, planos, bloqueios e horários.
- Agenda individual por profissional.
- Gestão de equipe e permissões por papel.
- Gestão de múltiplos estabelecimentos no mesmo acesso administrativo.
- Perfil, identidade e tema do estabelecimento.
- Temas visuais adaptados ao tipo de negócio com presets persistentes.
- Autenticação por e-mail, cadastro e recuperação de senha.
- Login com Google preparado, dependendo apenas da ativação do provedor no ambiente de autenticação.
- Proteção multi-tenant com Row Level Security no banco.
- Busca pública de agendamentos por telefone e data.
- Gerenciamento seguro do próprio agendamento por link assinado e expirável.
- Cancelamento e reagendamento público com nova validação de disponibilidade.
- Exportação do agendamento para calendário em `.ics`.
- Notificações persistentes de confirmação, cancelamento e lembrete de 24 horas.
- Envio transacional por e-mail via Brevo.
- Scheduler do GitHub Actions para processar a fila a cada 5 minutos.
- Assistente com Gemini para configurar o expediente por linguagem natural.
- Assistente operacional para consultar profissionais, serviços, agenda, bloqueios e disponibilidade real.
- Atalhos de disponibilidade que abrem a agenda já preenchida com o horário encontrado.

## Arquitetura

O projeto utiliza TypeScript com React, TanStack Start/Router, TanStack Query, Tailwind CSS e componentes baseados em shadcn/ui.

A persistência utiliza PostgreSQL/Supabase no ambiente conectado ao projeto. As funções de servidor concentram as validações críticas de disponibilidade, autenticação administrativa, geração de tokens e criação/reagendamento de agendamentos.

### Estrutura principal

```text
src/
├── components/
│   ├── dashboard/
│   ├── scheduling/
│   └── ui/
├── integrations/
│   └── supabase/
├── lib/
│   ├── ai/
│   ├── auth/
│   ├── notifications/
│   ├── scheduling/
│   └── theming/
├── routes/
│   ├── _authenticated/
│   ├── agenda/
│   └── auth/
└── scripts/
```

## Rotas principais

### Públicas

- `/` — apresentação da plataforma.
- `/agenda/{slug}` — agenda pública do estabelecimento.
- `/schedule?slug={slug}` — compatibilidade com o endereço legado.
- `/agenda/{slug}?custom=true` — duração personalizada.
- `/agenda/{slug}?standalone=true` — atendimento avulso sem serviço cadastrado.
- `/auth` — login, cadastro e recuperação de senha.

### Administrativas

- `/dashboard` — visão geral, próximos atendimentos e resumo semanal.
- `/dashboard/appointments` — agenda e agendamento manual.
- `/dashboard/services` — serviços.
- `/dashboard/professionals` — profissionais e agendas individuais.
- `/dashboard/customers` — clientes e planos atribuídos.
- `/dashboard/plans` — planos de clientes.
- `/dashboard/profile` — identidade, contato, tema e opções de agendamento.
- `/dashboard/team` — equipe e permissões.
- `/dashboard/settings` — expediente, intervalos e exceções.
- `/dashboard/assistant` — assistente de agenda com Gemini.
- `/dashboard/integrations` — estado das integrações e teste seguro do Brevo.

## Ambiente

Nunca versionar secrets reais. O arquivo `.env.example` lista somente os nomes das variáveis esperadas.

Principais variáveis:

```text
GEMINI_API_KEY=
GEMINI_SCHEDULE_MODEL=gemini-3.5-flash-lite
GEMINI_QUERY_MODEL=gemini-3.5-flash-lite
BREVO_API_KEY=
NOTIFICATION_FROM_EMAIL=rfpita.work@gmail.com
NOTIFICATION_FROM_NAME=Marca Minha Vez
PUBLIC_APP_URL=https://marca-minha-vez.lovable.app
NOTIFICATION_SIGNING_SECRET=
LOVABLE_CRON_SECRET=
```

As chaves do Gemini e da Brevo devem permanecer somente no ambiente do servidor. Nunca coloque os valores no GitHub ou no frontend.

## Desenvolvimento local

```bash
git clone https://github.com/pitarf/your-daily-spark.git
cd your-daily-spark
npm install
npm run dev
```

O projeto também utiliza Bun no pipeline de CI e no worker de notificações.

## Notificações

O worker pode ser executado manualmente com:

```bash
bun run notifications:dispatch
```

Em produção, o GitHub Actions chama o endpoint protegido a cada 5 minutos usando `LOVABLE_CRON_SECRET`.

Consulte `docs/notifications.md` para o fluxo completo.

## Qualidade

O GitHub Actions executa automaticamente:

1. TypeScript/typecheck
2. ESLint
3. Build de produção

Consulte `SECURITY.md` e `docs/production-checklist.md` antes de publicar uma nova versão.

## Documentação de evolução

`CHANGELOG.md` é o histórico permanente de alterações. Entradas antigas nunca devem ser removidas ou reescritas.

`PROJECT_STATUS.md` representa o estado atual do produto, separando funcionalidades concluídas, em desenvolvimento, pendentes e bloqueadas.

## Próximos blocos de produto

- Habilitação do provedor Google no ambiente de autenticação.
- WhatsApp oficial e, posteriormente, SMS.
- Cobrança, planos de assinatura e limites do SaaS.
- Domínio personalizado por estabelecimento.
- Personalização visual avançada por cores e layout.
- Métricas e relatórios mais completos.

## Origem do projeto

O projeto começou no Lovable e permanece sincronizado com o GitHub. O desenvolvimento principal pode ser feito diretamente no repositório, mantendo o Lovable como suporte para operações específicas do ambiente, principalmente banco e configuração da hospedagem.
