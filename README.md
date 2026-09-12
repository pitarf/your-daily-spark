# Marca Minha Vez

Plataforma multi-tenant de agendamento online para negócios baseados em horário, como barbearias, salões, nail designers, estética, clínicas, consultórios, estúdios e serviços em geral.

## O que o sistema já faz

- Agenda pública por estabelecimento em `/agenda/{slug}`.
- Escolha de serviço, profissional ou "qualquer profissional", data e horário.
- Cálculo de disponibilidade respeitando expediente, intervalos, folgas, exceções, bloqueios, duração do serviço e agendamentos existentes.
- Agendamento real com validação no servidor e proteção contra conflito de horários.
- Atendimentos avulsos, sem serviço pré-cadastrado, com título e duração personalizados.
- Duração personalizada de 15 minutos a 4 horas, em múltiplos de 15, quando habilitada pelo estabelecimento.
- Planos de clientes com limite de duração e serviços permitidos.
- Agenda administrativa em visões Dia, Semana e Mês.
- Agendamento manual pelo painel.
- Gestão de serviços, profissionais, clientes, planos, bloqueios e horários.
- Agenda individual por profissional.
- Gestão de equipe e permissões por papel.
- Perfil e identidade do estabelecimento.
- Temas visuais adaptados ao tipo de negócio.
- Autenticação por e-mail, cadastro e recuperação de senha.
- Proteção multi-tenant com Row Level Security no banco.

## Arquitetura

O projeto utiliza TypeScript com React, TanStack Start/Router, TanStack Query e Tailwind CSS, além de componentes baseados em shadcn/ui.

A persistência utiliza PostgreSQL/Supabase no ambiente conectado ao projeto. As funções de servidor concentram a validação das regras críticas de disponibilidade e criação de agendamentos.

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
│   ├── auth/
│   ├── scheduling/
│   └── theming/
└── routes/
    ├── _authenticated/
    ├── agenda/
    └── auth/
```

## Rotas principais

### Públicas

- `/` — apresentação da plataforma.
- `/agenda/{slug}` — agenda pública do estabelecimento.
- `/schedule?slug={slug}` — compatibilidade com o endereço legado.
- `/agenda/{slug}?custom=true` — alteração de duração do serviço.
- `/agenda/{slug}?standalone=true` — atendimento avulso sem serviço cadastrado.
- `/auth` — login, cadastro e recuperação de senha.

### Administrativas

- `/dashboard` — visão geral.
- `/dashboard/appointments` — agenda e agendamento manual.
- `/dashboard/services` — serviços.
- `/dashboard/professionals` — profissionais e agendas individuais.
- `/dashboard/customers` — clientes.
- `/dashboard/plans` — planos de clientes.
- `/dashboard/profile` — identidade e configurações públicas.
- `/dashboard/team` — equipe e permissões.
- `/dashboard/settings` — expediente, intervalos e exceções.

## Desenvolvimento local

```bash
git clone https://github.com/pitarf/your-daily-spark.git
cd your-daily-spark
npm install
npm run dev
```

O projeto também utiliza Bun no pipeline de CI.

## Qualidade

O GitHub Actions executa automaticamente:

1. TypeScript/typecheck
2. ESLint
3. Build de produção

## Documentação de evolução

`CHANGELOG.md` é o histórico permanente de alterações. Entradas antigas nunca devem ser removidas ou reescritas.

`PROJECT_STATUS.md` representa o estado atual do produto, separando funcionalidades concluídas, em desenvolvimento, pendentes e bloqueadas.

## Próximas integrações

- Habilitação do provedor Google.
- IA para configurar e consultar a agenda por linguagem natural.
- Notificações reais por e-mail, WhatsApp e SMS.
- Integração oficial com WhatsApp.
- Pagamentos e assinaturas SaaS.

## Origem do projeto

O projeto começou no Lovable e permanece sincronizado com o GitHub. O desenvolvimento principal pode ser feito diretamente no repositório, mantendo o Lovable como suporte para operações específicas do ambiente.
