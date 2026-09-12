# Changelog

## 2025-12-19
- **Objetivo da alteração**: Criar arquivos de documentação iniciais para rastreamento permanente de alterações e estado do projeto.
- **Funcionalidades implementadas**: Arquivos `CHANGELOG.md` e `PROJECT_STATUS.md` criados na raiz do projeto.
- **Arquivos alterados**: Nenhum (arquivos novos criados).
- **Testes realizados**: N/A.
- **Problemas encontrados**: Nenhum.
- **Pendências relacionadas**: Nenhuma.

## 2025-05-20
- **Objetivo da alteração**: Atualizar documentação de rastreamento após análise inicial.
- **Funcionalidades implementadas**: Atualização de `CHANGELOG.md` e `PROJECT_STATUS.md`.
- **Arquivos alterados**: `CHANGELOG.md`, `PROJECT_STATUS.md`.
- **Testes realizados**: N/A.
- **Problemas encontrados**: Nenhum.
- **Pendências relacionadas**: Nenhuma.

## 2026-09-11
- **Objetivo da alteração**: Implementar a fundação persistente multi-tenant do Marca Minha Vez no banco de dados do projeto e integrar a agenda pública a dados reais.
- **Funcionalidades implementadas**: schema multi-tenant completo, RLS, proteção contra conflitos, seed da barbearia demo, motor de disponibilidade e integração da agenda pública com o banco.
- **Arquivos alterados**: módulos de scheduling, `package.json`, `CHANGELOG.md`, `PROJECT_STATUS.md` e migrations do banco.
- **Testes realizados**: migrations, seed, conflitos, bloqueios, duração mínima, disponibilidade do Platinado e typecheck.
- **Problemas encontrados**: nenhum bloqueador conhecido.
- **Pendências relacionadas**: autenticação, criação real de agendamento e painel administrativo.

## 2026-09-11 (2)
- **Objetivo da alteração**: Habilitar login/cadastro, painel administrativo e criação real de agendamentos.
- **Funcionalidades implementadas**: autenticação por e-mail, recuperação de senha, dashboard protegido, onboarding, criação pública de agendamento e alocação de qualquer profissional.
- **Arquivos alterados**: `src/routes/__root.tsx`, `src/routes/index.tsx`, `src/routes/schedule.tsx`, server functions, autenticação, dashboard e documentação.
- **Testes realizados**: agendamento pela tela, alocação de profissional, Platinado, sábado/domingo, privacidade, autenticação, onboarding e typecheck.
- **Problemas encontrados**: disponibilidade de "qualquer profissional" corrigida para considerar ao menos um profissional livre.
- **Pendências relacionadas**: gestão de horários, exceções, planos, equipe e integrações futuras.

## 2026-09-11 (3)
- **Objetivo da alteração**: Tornar a agenda pública reutilizável por qualquer estabelecimento.
- **Funcionalidades implementadas**: `/schedule` passou a aceitar `slug`, e o link público usa o estabelecimento real.
- **Arquivos alterados**: `src/routes/schedule.tsx`, `src/routes/_authenticated/dashboard/settings.tsx`, `CHANGELOG.md`.
- **Testes realizados**: validação estrutural do fluxo por slug.
- **Problemas encontrados**: nenhum conhecido.
- **Pendências relacionadas**: rota amigável dedicada e gestão visual de horários.

## 2026-09-11 (4)
- **Objetivo da alteração**: Liberar gestão do expediente geral e fechamentos específicos pelo painel.
- **Funcionalidades implementadas**: dias ativos, início/fim, múltiplos intervalos e exceções de agenda.
- **Arquivos alterados**: `src/routes/_authenticated/dashboard/settings.tsx`, `CHANGELOG.md`, `PROJECT_STATUS.md`.
- **Testes realizados**: validação estrutural e conferência do schema.
- **Problemas encontrados**: nenhum conhecido.
- **Pendências relacionadas**: agenda individual de profissional e equipe.

## 2026-09-11 (5)
- **Objetivo da alteração**: Consolidar regras de negócio do MVP sem consumir créditos do Lovable.
- **Funcionalidades implementadas**: agenda individual, planos de clientes, bloqueios, exceções com horário especial, regras de plano e correções de overrides.
- **Arquivos alterados**: módulos de scheduling, profissionais, clientes, agendamentos, configurações e documentação.
- **Testes realizados**: revisão estrutural das integrações e persistência.
- **Problemas encontrados**: filtro de agendas individuais inativas corrigido.
- **Pendências relacionadas**: equipe, URL amigável, identidade do estabelecimento e integrações futuras.

## 2026-09-12 (6)
- **Objetivo da alteração**: Corrigir a experiência pública de calendário por fuso e elevar a apresentação inicial do produto.
- **Funcionalidades implementadas**: cálculo de datas sensível ao fuso, acessibilidade básica e nova homepage comercial.
- **Arquivos alterados**: `src/lib/scheduling/format.ts`, `src/routes/schedule.tsx`, `src/routes/index.tsx`, `CHANGELOG.md`, `PROJECT_STATUS.md`.
- **Testes realizados**: revisão estrutural.
- **Problemas encontrados**: deslocamentos de data em UTC corrigidos.
- **Pendências relacionadas**: rota amigável, perfil e equipe.

## 2026-09-12 (7)
- **Objetivo da alteração**: Corrigir precedência de exceções específicas de profissional.
- **Funcionalidades implementadas**: horário especial específico vence horário especial geral.
- **Arquivos alterados**: `src/lib/scheduling/availability.ts`, `CHANGELOG.md`.
- **Testes realizados**: revisão estrutural do motor.
- **Problemas encontrados**: seleção anterior podia escolher exceção personalizada incorreta.
- **Pendências relacionadas**: rota amigável, equipe e integrações futuras.

## 2026-09-12 (8)
- **Objetivo da alteração**: Completar a precedência das exceções de agenda.
- **Funcionalidades implementadas**: fechamento individual > horário especial individual > fechamento geral > horário especial geral > agenda semanal.
- **Arquivos alterados**: `src/lib/scheduling/availability.ts`, `CHANGELOG.md`.
- **Testes realizados**: revisão estrutural da matriz de precedência.
- **Problemas encontrados**: interação entre fechamento geral e horário especial específico corrigida.
- **Pendências relacionadas**: rota amigável, equipe, perfil e integrações futuras.

## 2026-09-12 (9)
- **Objetivo da alteração**: Criar área dedicada para administrar a identidade e os dados públicos do estabelecimento.
- **Funcionalidades implementadas**: rota `/dashboard/profile`, edição de dados comerciais e identidade visual, pré-visualização da logo e acesso restrito para edição a administradores.
- **Arquivos alterados**: `src/routes/_authenticated/dashboard/profile.tsx`, `src/routes/_authenticated/dashboard/route.tsx`, `src/routeTree.gen.ts`, `CHANGELOG.md`.
- **Testes realizados**: revisão estrutural de leitura/atualização e proteção por papel.
- **Problemas encontrados**: nenhum conhecido.
- **Pendências relacionadas**: URL amigável, equipe e integrações futuras.

## 2026-09-12 (10)
- **Objetivo da alteração**: Criar URL pública amigável para o agendamento sem quebrar links legados.
- **Funcionalidades implementadas**: `/agenda/{slug}`, componente compartilhado de booking, compatibilidade com `/schedule?slug=` e metadados básicos de SEO.
- **Arquivos alterados**: `src/routes/schedule.tsx`, `src/routeTree.gen.ts`, `CHANGELOG.md`, nova rota e componente de booking.
- **Testes realizados**: revisão estrutural da integração entre rota, loader e motor de disponibilidade.
- **Problemas encontrados**: nenhum conhecido.
- **Pendências relacionadas**: equipe, login social, IA, notificações, pagamentos e WhatsApp.

## 2026-09-12 (11)
- **Objetivo da alteração**: Adicionar verificação contínua de qualidade ao repositório.
- **Funcionalidades implementadas**: GitHub Actions para TypeScript, ESLint e build em PRs e pushes para `main`.
- **Arquivos alterados**: `.github/workflows/ci.yml`, `CHANGELOG.md`, `PROJECT_STATUS.md`.
- **Testes realizados**: pipeline configurado para validar automaticamente novas alterações.
- **Problemas encontrados**: nenhum conhecido nesta etapa.
- **Pendências relacionadas**: equipe, login social, IA, notificações, pagamentos e WhatsApp.

## 2026-09-12 (12)
- **Objetivo da alteração**: Implementar o gerenciamento de acesso da equipe sem criar uma nova tabela de convites.
- **Funcionalidades implementadas**:
  - Nova página `/dashboard/team` para administradores.
  - Convite de profissional por e-mail usando a autenticação administrativa do Supabase no servidor.
  - Conta convidada/existente associada ao profissional por `professionals.user_id`.
  - Membership `professional` criada ou atualizada em `establishment_users`.
  - Remoção do acesso desassocia o profissional e remove apenas o vínculo daquele estabelecimento, sem apagar a conta do usuário.
  - Proteção server-side: somente administrador do estabelecimento pode convidar ou remover acesso.
  - Novo item "Equipe" na navegação do dashboard.
  - Rota registrada no route tree.
- **Arquivos alterados**: `src/routes/_authenticated/dashboard/route.tsx`, `src/routeTree.gen.ts`, `CHANGELOG.md`; novos: `src/routes/_authenticated/dashboard/team.tsx`, `src/lib/auth/team.functions.ts`.
- **Testes realizados**: revisão estrutural do fluxo de autenticação, vínculo profissional-usuário e isolamento por estabelecimento; sem alteração de schema.
- **Problemas encontrados**: o painel do profissional ainda precisa ser restringido para mostrar somente dados pertencentes ao próprio profissional.
- **Pendências relacionadas**: escopo do painel do profissional; login social; IA; notificações reais; pagamentos e WhatsApp.

## 2026-09-12 (13)
- **Objetivo da alteração**: Consolidar o controle de acesso por papel e ampliar a agenda administrativa.
- **Funcionalidades implementadas**:
  - Profissionais passaram a ter navegação administrativa restrita e acesso ao próprio espaço de agenda.
  - Escopos de RLS do ambiente foram conferidos para profissionais em agendamentos, clientes, serviços, profissionais, horários e bloqueios.
  - Login com Google preparado na interface, aguardando apenas a habilitação do provedor no ambiente de autenticação.
  - Correção da busca administrativa de usuários por e-mail para convites da equipe.
  - Registro da rota de equipe no route tree.
  - Agenda administrativa com visualização por dia, semana e mês.
  - Agendamento manual pelo administrador reutilizando o motor de disponibilidade.
  - Navegação civil do calendário com tratamento de mês, semana e fuso.
  - Ajustes de qualidade no TypeScript/ESLint e pipeline validado com TypeScript, lint e build de produção.
- **Arquivos alterados**: `src/routes/_authenticated/dashboard/appointments.tsx`, `src/lib/scheduling/calendar.ts`, `src/lib/auth/role-access.ts`, `src/lib/auth/team.functions.ts`, `src/lib/auth/auth-client.ts`, `src/routes/auth.tsx`, `src/components/dashboard/ProfessionalWorkspace.tsx`, `src/routeTree.gen.ts`, `tsconfig.json`, `eslint.config.js`, `CHANGELOG.md`, `PROJECT_STATUS.md`.
- **Testes realizados**: GitHub Actions validou TypeScript, ESLint e build de produção no pipeline mais recente.
- **Problemas encontrados**: login com Google ainda depende da habilitação do provedor; duração totalmente personalizada sem serviço cadastrado ainda não faz parte do fluxo.
- **Pendências relacionadas**: habilitar Google, IA, notificações reais, pagamentos, WhatsApp e duração personalizada independente de serviço.

## 2026-09-12 (14)
- **Objetivo da alteração**: Finalizar a primeira camada de gestão comercial e de agenda do painel.
- **Funcionalidades implementadas**:
  - Nova área autenticada `/dashboard/plans` para criar, editar, ativar/desativar planos e definir serviços permitidos e duração máxima.
  - Atalho de Planos no dashboard e menu administrativo.
  - Regras de acesso por papel atualizadas para manter Planos restrito a administradores.
  - Rota legada `/establishment/plans` deixou de ser placeholder e passou a encaminhar o usuário para a gestão autenticada.
  - Agenda administrativa permanece com Dia, Semana e Mês, agendamento manual e bloqueios.
  - Migração versionada das políticas RLS restritivas para escopo profissional.
- **Arquivos alterados**: `src/routes/_authenticated/dashboard/plans.tsx`, `src/routes/_authenticated/dashboard/route.tsx`, `src/routes/_authenticated/dashboard/index.tsx`, `src/routes/establishment/plans.tsx`, `src/lib/auth/role-access.ts`, `src/routeTree.gen.ts`, `supabase/migrations/20260912050500_professional_rls_scope.sql`, `CHANGELOG.md`, `PROJECT_STATUS.md`.
- **Testes realizados**: GitHub Actions já validou TypeScript, ESLint e build na etapa imediatamente anterior; nova execução foi acionada após os ajustes de planos.
- **Problemas encontrados**: nenhum novo bloqueador conhecido.
- **Pendências relacionadas**: duração personalizada independente de serviço, IA, Google, notificações reais, pagamentos e WhatsApp.

## 2026-09-12 (15)
- **Objetivo da alteração**: Preparar a base do banco para permitir duração personalizada em futuros fluxos de agendamento.
- **Funcionalidades implementadas**:
  - `establishments.allow_custom_duration` com padrão seguro `false`.
  - `appointments.duration_minutes_override` opcional.
  - Constraint para impedir duração personalizada menor ou igual a zero.
  - Migration versionada em `supabase/migrations/20260912051500_custom_duration.sql`.
- **Arquivos alterados**: nova migration `supabase/migrations/20260912051500_custom_duration.sql` e banco do projeto.
- **Testes realizados**: alteração aplicada no PostgreSQL do projeto; pipeline de TypeScript/ESLint/build segue sendo executado nas alterações subsequentes.
- **Problemas encontrados**: a UI e o motor de disponibilidade ainda não usam a duração personalizada.
- **Pendências relacionadas**: implementar o fluxo de duração personalizada e respeitar o limite do plano do cliente.

## 2026-09-12 (16)
- **Objetivo da alteração**: Consolidar a etapa de planos no painel e manter o gateway de qualidade verde.
- **Funcionalidades implementadas**: gestão autenticada de planos, atalho no dashboard, proteção por papel, rota legada encaminhada e route tree atualizado.
- **Arquivos alterados**: `src/routes/_authenticated/dashboard/plans.tsx`, `src/routes/_authenticated/dashboard/index.tsx`, `src/routes/_authenticated/dashboard/route.tsx`, `src/routes/establishment/plans.tsx`, `src/lib/auth/role-access.ts`, `src/routeTree.gen.ts`, documentação.
- **Testes realizados**: GitHub Actions run #35 validou TypeScript, ESLint e build de produção com sucesso.
- **Problemas encontrados**: nenhum bloqueador de qualidade nesta etapa.
- **Pendências relacionadas**: duração personalizada, IA, Google, notificações reais, pagamentos e WhatsApp.

## 2026-09-12 (17)
- **Objetivo da alteração**: Implementar o fluxo público de agendamento com duração personalizada sem remover a opção de duração padrão.
- **Funcionalidades implementadas**:
  - Nova página `/agenda/{slug}/personalizado`.
  - Seleção de serviço, profissional/qualquer profissional, data e duração de 15 a 240 minutos em passos de 15.
  - Cálculo real de disponibilidade por profissional, considerando expediente, intervalos, exceções, bloqueios e agendamentos existentes.
  - Reserva server-side com validação novamente no momento da confirmação.
  - Aplicação das regras de plano do cliente ao agendamento personalizado.
  - Nova configuração administrativa para ativar/desativar duração personalizada.
  - O fluxo público principal agora apresenta o acesso ao agendamento personalizado.
  - Migration versionada da coluna de configuração e do override de duração.
- **Arquivos alterados**: `src/components/scheduling/CustomDurationBookingPage.tsx`, `src/routes/agenda/$slug/personalizado.tsx`, `src/routes/agenda/$slug.tsx`, `src/routes/_authenticated/dashboard/booking-rules.tsx`, `src/lib/scheduling/custom-duration.functions.ts`, `supabase/migrations/20260912051500_custom_duration.sql`, `CHANGELOG.md`.
- **Testes realizados**: validação estrutural da disponibilidade individual por profissional e da checagem server-side no ato da reserva.
- **Problemas encontrados**: o pipeline precisa validar a nova rota e a tipagem gerada do TanStack Router.
- **Pendências relacionadas**: habilitar/desabilitar Google, IA, notificações reais, pagamentos, WhatsApp e evolução visual por tipo de negócio.
