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
- **Pendências relacionadas**: habilitar Google, IA, notificações, pagamentos, WhatsApp e duração personalizada independente de serviço.

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
- **Objetivo da alteração**: Conectar a base de duração personalizada ao fluxo público e torná-la utilizável sem consumir créditos do Lovable.
- **Funcionalidades implementadas**:
  - Novo fluxo público `/agenda-personalizada/{slug}`.
  - Seleção de serviço, profissional/qualquer profissional, data, duração entre 15 minutos e 4 horas e horário disponível.
  - Revisão e confirmação do atendimento personalizado com validação server-side já existente.
  - Atalho para o fluxo personalizado na agenda pública principal.
  - Confirmação do ambiente Lovable/Supabase: `allow_custom_duration` está habilitado para a Barbearia Marca Minha Vez.
- **Arquivos alterados**: `src/components/scheduling/CustomDurationBookingPage.tsx`, `src/routes/agenda-personalizada/$slug.tsx`, `src/routes/agenda/$slug.tsx`, `CHANGELOG.md`, `PROJECT_STATUS.md`.
- **Testes realizados**: conferência do schema e do banco live no ambiente Lovable; verificação estrutural das funções `getCustomDurationAvailability` e `createCustomDurationAppointment`.
- **Problemas encontrados**: a rota principal teve um import incorreto durante a alteração e foi corrigida antes da consolidação da branch.
- **Pendências relacionadas**: agendamento avulso sem serviço base, IA, Google, notificações reais, pagamentos e WhatsApp.

## 2026-09-12 (18)
- **Objetivo da alteração**: Estabilizar o fluxo de duração personalizada após a primeira execução do CI e remover uma rota dinâmica desnecessária.
- **Funcionalidades implementadas**:
  - O fluxo personalizado passou a compartilhar a rota `/agenda/{slug}` usando `?custom=true`, evitando nova entrada no route tree.
  - Backend de duração personalizada foi reestruturado para manter a validação server-side, escolha de profissional, regras de plano e proteção contra conflitos.
  - Tela pública simplificada e tipada, mantendo serviço, profissional, data, duração, horário e confirmação.
  - O ajuste é compatível com a base de banco já existente.
  - `PROJECT_STATUS.md` atualizado para refletir o estado real.
- **Arquivos alterados**: `src/lib/scheduling/custom-duration.functions.ts`, `src/components/scheduling/CustomDurationBookingPage.tsx`, `src/routes/agenda/$slug.tsx`, `eslint.config.js`, `PROJECT_STATUS.md`, `CHANGELOG.md`.
- **Testes realizados**: GitHub Actions run #48 validou TypeScript, ESLint e build de produção com sucesso após a estabilização do fluxo.
- **Problemas encontrados**: a execução inicial encontrou erro de tipos no Supabase e referência a uma rota ainda não registrada no route tree; ambos foram corrigidos em commits posteriores sem reescrever o histórico.
- **Pendências relacionadas**: agendamento avulso sem serviço base, IA, Google, notificações reais, pagamentos e WhatsApp.

## 2026-09-12 (19)
- **Objetivo da alteração**: Implementar o agendamento avulso totalmente personalizado, sem exigir serviço pré-cadastrado.
- **Funcionalidades implementadas**:
  - `appointments.service_id` passou a aceitar `NULL` para atendimentos avulsos.
  - Novos campos `custom_title` e `custom_price` no agendamento.
  - Constraint garante que um atendimento tenha serviço ou título personalizado.
  - Novo fluxo público para o cliente informar o que precisa, escolher profissional, data, duração, horário e dados de contato.
  - Disponibilidade e conflitos continuam sendo validados no servidor.
  - Planos do cliente continuam respeitando o limite de duração mesmo em atendimentos avulsos.
  - Migration versionada em `supabase/migrations/20260912060000_standalone_custom_appointments.sql`.
- **Arquivos alterados**: `src/lib/scheduling/standalone-custom-booking.functions.ts`, `src/components/scheduling/StandaloneCustomBookingPage.tsx`, `src/routes/agenda/$slug.tsx`, nova migration, `PROJECT_STATUS.md`, `CHANGELOG.md`.
- **Testes realizados**: alteração do schema aplicada no PostgreSQL do ambiente Lovable e verificação estrutural do fluxo server-side.
- **Problemas encontrados**: a apresentação administrativa de atendimentos sem serviço ainda precisa de um refinamento para exibir o título personalizado no calendário.
- **Pendências relacionadas**: UI administrativa de atendimentos avulsos, IA, Google, notificações reais, pagamentos e WhatsApp.

## 2026-09-12 (20)
- **Objetivo da alteração**: Refinar a apresentação administrativa dos atendimentos avulsos sem serviço.
- **Funcionalidades implementadas**:
  - Calendário administrativo agora exibe o `custom_title` de atendimentos avulsos em vez de apresentar serviço vazio.
  - Preço personalizado, quando existir, passa a ser exibido corretamente.
  - Duração personalizada passa a aparecer no detalhe do atendimento.
  - As visões Dia, Semana e Mês utilizam o mesmo rótulo de atendimento para manter consistência.
- **Arquivos alterados**: `src/routes/_authenticated/dashboard/appointments.tsx`, `PROJECT_STATUS.md`, `CHANGELOG.md`.
- **Testes realizados**: revisão estrutural do fluxo de leitura dos campos `custom_title`, `custom_price` e `duration_minutes_override`.
- **Problemas encontrados**: nenhum novo bloqueador conhecido.
- **Pendências relacionadas**: refinamentos gerais de UX, IA, Google, notificações reais, pagamentos e WhatsApp.

## 2026-09-12 (21)
- **Objetivo da alteração**: Corrigir a apresentação de atendimentos avulsos no espaço do profissional.
- **Funcionalidades implementadas**:
  - O painel do profissional passou a aceitar `service_id` nulo para atendimentos avulsos.
  - O `custom_title` agora aparece como título do atendimento quando não há serviço cadastrado.
  - A duração personalizada (`duration_minutes_override`) passa a ser exibida.
  - A consulta continua limitada ao profissional autenticado e aos atendimentos futuros do próprio estabelecimento.
- **Arquivos alterados**: `src/components/dashboard/ProfessionalWorkspace.tsx`, `PROJECT_STATUS.md`, `CHANGELOG.md`.
- **Testes realizados**: revisão estrutural da consulta autenticada e da renderização dos campos de atendimento avulso.
- **Problemas encontrados**: nenhum novo bloqueador conhecido.
- **Pendências relacionadas**: refinamentos gerais de UX, IA, Google, notificações reais, pagamentos e WhatsApp.

## 2026-09-12 (22)
- **Objetivo da alteração**: Expor no perfil administrativo a configuração que controla agendamentos personalizados e corrigir o link público amigável.
- **Funcionalidades implementadas**:
  - Administrador pode ativar/desativar `allow_custom_duration` diretamente no perfil do estabelecimento.
  - A configuração deixa claro que o cliente poderá alterar a duração e utilizar atendimento sem serviço quando habilitada.
  - O link exibido no painel passa a usar `/agenda/{slug}` em vez da URL legada.
- **Arquivos alterados**: `src/routes/_authenticated/dashboard/profile.tsx`, `CHANGELOG.md`, `PROJECT_STATUS.md`.
- **Testes realizados**: revisão estrutural da leitura e atualização do campo `allow_custom_duration`.
- **Problemas encontrados**: nenhum novo bloqueador conhecido.
- **Pendências relacionadas**: refinamentos gerais de UX, IA, Google, notificações reais, pagamentos e WhatsApp.

## 2026-09-12 (23)
- **Objetivo da alteração**: Atualizar a documentação principal para refletir o produto real Marca Minha Vez.
- **Funcionalidades implementadas**: README reescrito com proposta do produto, arquitetura, rotas, desenvolvimento local, CI, documentação e próximas integrações.
- **Arquivos alterados**: `README.md`, `CHANGELOG.md`.
- **Testes realizados**: revisão manual da documentação contra a estrutura atual do repositório.
- **Problemas encontrados**: README anterior ainda descrevia o projeto como "Your Daily Spark".
- **Pendências relacionadas**: refinamentos gerais de UX, IA, Google, notificações reais, pagamentos e WhatsApp.

## 2026-09-12 (24)
- **Objetivo da alteração**: Refinar a experiência da agenda pública conforme a configuração do estabelecimento.
- **Funcionalidades implementadas**:
  - As opções "Não encontrei meu serviço" e "Alterar duração do serviço" só aparecem quando o estabelecimento habilita agendamento personalizado.
  - Acesso direto a `?custom=true` ou `?standalone=true` quando o recurso está desativado passa a mostrar uma mensagem clara de indisponibilidade e retorno para a agenda.
  - Criada função server-side isolada para expor somente a configuração pública `allow_custom_duration`, sem alterar o motor central de disponibilidade.
- **Arquivos alterados**: `src/routes/agenda/$slug.tsx`, novo `src/lib/scheduling/public-settings.functions.ts`, `PROJECT_STATUS.md`, `CHANGELOG.md`.
- **Testes realizados**: revisão estrutural do fluxo público e validação da consulta somente com o campo necessário.
- **Problemas encontrados**: a função central de scheduling ainda não expõe `allow_custom_duration`; a nova função isolada evita acoplamento desnecessário.
- **Pendências relacionadas**: refinamentos gerais de UX, IA, Google, notificações reais, pagamentos e WhatsApp.

## 2026-09-12 (25)
- **Objetivo da alteração**: Corrigir a apresentação de atendimentos avulsos no dashboard inicial.
- **Funcionalidades implementadas**:
  - O resumo "Agenda de hoje" agora usa o `custom_title` quando o agendamento não possui serviço cadastrado.
  - A lista de próximos agendamentos também identifica corretamente atendimentos avulsos.
- **Arquivos alterados**: `src/routes/_authenticated/dashboard/index.tsx`, `CHANGELOG.md`, `PROJECT_STATUS.md`.
- **Testes realizados**: revisão estrutural da consulta e da renderização dos campos personalizados.
- **Problemas encontrados**: nenhum novo bloqueador conhecido.
- **Pendências relacionadas**: refinamentos gerais de UX, IA, Google, notificações reais, pagamentos e WhatsApp.

## 2026-09-12 (26)
- **Objetivo da alteração**: Registrar eventos de agendamento na fila interna de notificações e expor a atividade no dashboard.
- **Funcionalidades implementadas**:
  - Trigger de banco para criar notificação de confirmação ao inserir um agendamento.
  - Trigger de banco para criar notificação de cancelamento quando o status muda para cancelado.
  - Histórico de eventos recentes exibido no dashboard do estabelecimento.
  - Tipos e rótulos centralizados em `src/lib/notifications.ts`.
- **Arquivos alterados**: `supabase/migrations/20260912071500_appointment_notifications.sql`, `src/lib/notifications.ts`, `src/routes/_authenticated/dashboard/index.tsx`, `CHANGELOG.md`, `PROJECT_STATUS.md`.
- **Testes realizados**: trigger aplicado no PostgreSQL do ambiente Lovable e conferência das políticas RLS da tabela `notifications`.
- **Problemas encontrados**: entrega real por e-mail, WhatsApp ou SMS continua dependendo de provedor externo.
- **Pendências relacionadas**: implementar worker/provedor de entrega das notificações reais.

## 2026-09-12 (27)
- **Objetivo da alteração**: Permitir que cada estabelecimento escolha um preset visual persistente para a agenda pública.
- **Funcionalidades implementadas**:
  - Novo campo `establishments.theme_preset` com opções `auto`, `minimal`, `soft`, `bold`, `dark` e `warm`.
  - Perfil administrativo ganhou seleção de tema com cartões e pré-visualização.
  - Tema selecionado é persistido no banco e aplicado na rota pública `/agenda/{slug}`.
  - O modo `auto` continua utilizando a identidade visual associada ao tipo de negócio.
  - Cabeçalho público passou a apresentar logo, tipo de negócio e atalho para WhatsApp quando houver contato cadastrado.
  - Tipos TypeScript do schema foram sincronizados com `theme_preset`.
- **Arquivos alterados**: `supabase/migrations/20260912073000_establishment_theme_preset.sql`, `src/lib/theming/business-theme.ts`, `src/lib/theming/establishment-theme.functions.ts`, `src/routes/_authenticated/dashboard/profile.tsx`, `src/routes/agenda/$slug.tsx`, `src/integrations/supabase/types.ts`, `CHANGELOG.md`, `PROJECT_STATUS.md`.
- **Testes realizados**: coluna e constraint conferidos no PostgreSQL do ambiente Lovable; revisão estrutural da leitura, persistência e aplicação do preset.
- **Problemas encontrados**: nenhum bloqueador conhecido.
- **Pendências relacionadas**: personalização avançada por cores/layout, IA, Google, entrega real de notificações, pagamentos e WhatsApp oficial.

## 2026-09-12 (28)
- **Objetivo da alteração**: Preparar a fila de notificações para lembretes e reagendamentos sem criar um serviço de envio prematuramente.
- **Funcionalidades implementadas**:
  - Ao criar um agendamento futuro, a fila passa a registrar também um lembrete para 24 horas antes do atendimento.
  - Ao cancelar um agendamento, lembretes ainda não enviados são marcados como cancelados.
  - Ao alterar o horário de um agendamento não cancelado, o lembrete anterior é invalidado e um novo lembrete é calculado para o novo horário.
  - Migration versionada em `supabase/migrations/20260912080000_notification_reminders.sql`.
- **Arquivos alterados**: `supabase/migrations/20260912080000_notification_reminders.sql`, `CHANGELOG.md`.
- **Testes realizados**: trigger atualizado diretamente no PostgreSQL do ambiente Lovable e conferência da existência do trigger `appointments_create_notifications` para INSERT e UPDATE.
- **Problemas encontrados**: a entrega física do lembrete ainda depende de um worker/provedor externo.
- **Pendências relacionadas**: worker de notificações, IA, Google, pagamentos e WhatsApp oficial.

## 2026-09-12 (29)
- **Objetivo da alteração**: Melhorar a experiência imediatamente após um agendamento público.
- **Funcionalidades implementadas**:
  - Botão "Adicionar ao calendário" disponível após agendamento normal.
  - O mesmo recurso foi adicionado aos fluxos de duração personalizada e agendamento avulso.
  - Arquivo `.ics` é gerado no navegador com data, horário, duração, profissional, título e descrição do atendimento.
  - A exportação usa UTC internamente para manter o mesmo instante do agendamento independentemente do aplicativo de calendário utilizado.
- **Arquivos alterados**: novo `src/lib/calendar/ics.ts`, `src/components/scheduling/BookingPage.tsx`, `src/components/scheduling/CustomDurationBookingPage.tsx`, `src/components/scheduling/StandaloneCustomBookingPage.tsx`, `CHANGELOG.md`.
- **Testes realizados**: revisão estrutural da geração do calendário e integração nos três fluxos públicos de confirmação.
- **Problemas encontrados**: nenhum novo bloqueador conhecido.
- **Pendências relacionadas**: gestão posterior do agendamento pelo cliente, worker de notificações, IA, Google, pagamentos e WhatsApp oficial.
