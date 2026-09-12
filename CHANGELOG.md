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
- **Funcionalidades implementadas**:
  - Tabelas criadas: `profiles`, `establishments`, `establishment_users`, `professionals`, `services`, `professional_services`, `weekly_schedules`, `schedule_breaks`, `schedule_exceptions`, `customers`, `customer_plans`, `customer_plan_services`, `customer_plan_assignments`, `appointments`, `blocked_slots`, `notifications`.
  - Tipos: `establishment_role`, `appointment_status`, `schedule_exception_type`, `notification_type`, `notification_status`.
  - IDs em UUID, `timestamptz` em todas as datas, `timezone` por estabelecimento, `duration_minutes > 0`, FKs e índices por `establishment_id`/data.
  - Anti-conflito: constraint de exclusão GiST em `appointments` (mesmo profissional não pode ter horários sobrepostos) + triggers cruzados entre `appointments` e `blocked_slots`.
  - `updated_at` automático via trigger; criação automática de `profiles` no cadastro de usuário (`auth.users`).
  - RLS habilitado em todas as tabelas, com funções `is_establishment_member` e `has_establishment_role` (SECURITY DEFINER, sem acesso anônimo). Leitura pública apenas de estabelecimento ativo, serviços, profissionais, agenda semanal, intervalos e exceções. Clientes, agendamentos, planos, bloqueios e notificações são privados ao estabelecimento.
  - Seed: Barbearia Marca Minha Vez; serviços Corte (30/R$35), Barba (30/R$25), Corte + Barba (60/R$55), Platinado (120/R$120); profissionais João e Carlos; seg-sex 09:00-18:00 com intervalo 12:00-13:00 e sábado 09:00-14:00.
  - Motor de disponibilidade criado em `src/lib/scheduling/availability.ts` (puro, com suporte a fuso do estabelecimento, intervalos, exceções e ocupações).
  - Camada de acesso a dados em `src/lib/scheduling/scheduling.functions.ts` (server functions): configuração pública da agenda e disponibilidade livre/ocupado sem expor dados de clientes.
  - `src/routes/schedule.tsx` passou a consumir dados reais do banco (serviço, profissional, data e grade de horários), com metadados de SEO próprios.
- **Arquivos alterados**: `src/routes/schedule.tsx`, `CHANGELOG.md`, `PROJECT_STATUS.md`, `package.json` (`@supabase/supabase-js`); novos: `src/lib/scheduling/availability.ts`, `src/lib/scheduling/scheduling.functions.ts`.
- **Testes realizados**:
  - Migrations aplicadas com sucesso; seed conferido (4 serviços, 2 profissionais, 6 agendas, 5 intervalos, 8 vínculos profissional-serviço).
  - Conflito de agenda: segundo agendamento sobreposto do mesmo profissional rejeitado.
  - Bloqueio sobre agendamento existente rejeitado; agendamento dentro de bloqueio rejeitado.
  - `duration_minutes = 0` rejeitado.
  - Página `/schedule` validada no navegador: Corte (30 min) oferece até 17:30; Platinado (120 min) só até 16:00 e fica indisponível de 10:15 a 12:45 por causa do intervalo 12:00-13:00. Sem erros de console.
  - Typecheck do projeto sem erros.
- **Problemas encontrados**: A extensão `btree_gist` fica no schema público e as duas funções auxiliares de RLS são executáveis por usuários autenticados — ambos são requisitos das políticas/constraints e foram mantidos de forma intencional.
- **Pendências relacionadas**: telas de login/cadastro e vínculo de usuários a estabelecimentos; criação de agendamento pela interface; painel do profissional; gestão de clientes e planos na interface.

## 2026-09-11 (2)
- **Objetivo da alteração**: Habilitar login/cadastro dos estabelecimentos, o painel administrativo e a criação real de agendamentos pela tela pública.
- **Funcionalidades implementadas**:
  - Autenticação por e-mail e senha (Lovable Cloud Auth) com telas `/auth` (entrar, criar conta, recuperar senha) e `/reset-password`. Sem senha própria: toda a credencial fica no serviço de autenticação.
  - Área protegida `/dashboard` (redireciona para `/auth` sem sessão) com visão geral, agenda do dia, serviços, profissionais, clientes e configurações — todos lendo e gravando dados reais sob RLS.
  - Onboarding: criar um novo estabelecimento (o criador vira admin) ou reivindicar a barbearia de demonstração quando ela ainda não tem responsável.
  - Criação de agendamento pela página pública `/schedule`: escolha de serviço, profissional (ou "qualquer profissional"), dia, horário, dados do cliente, revisão e confirmação. Toda a validação é refeita no servidor antes de gravar.
  - Disponibilidade combinada: sem profissional escolhido, o horário aparece livre quando ao menos um profissional que faz o serviço estiver livre; ao confirmar, o sistema aloca um profissional realmente disponível.
  - Sessão global observada na raiz do app (a interface reage a entrar/sair sem recarregar).
- **Arquivos alterados**: `src/routes/__root.tsx`, `src/routes/index.tsx`, `src/routes/schedule.tsx`, `src/lib/scheduling/scheduling.functions.ts`, `CHANGELOG.md`, `PROJECT_STATUS.md`; novos: `src/routes/auth.tsx`, `src/routes/reset-password.tsx`, `src/routes/_authenticated/route.tsx`, `src/routes/_authenticated/dashboard/*`, `src/lib/auth/auth-client.ts`, `src/lib/auth/establishment-context.tsx`, `src/lib/scheduling/format.ts`.
- **Testes realizados** (navegador real + banco):
  - Agendamento completo pela tela com João às 09:00 de segunda: confirmação exibida e registro conferido no banco (09:00-09:30 no fuso do estabelecimento).
  - Após o agendamento, 09:00 fica indisponível para João e continua livre para Carlos; agendamento com "qualquer profissional" foi alocado corretamente ao Carlos.
  - Platinado (120 min) na segunda só oferece 09:30, 09:45, 10:00 e 13:00-16:00 — respeitando o intervalo 12:00-13:00 e o fechamento às 18:00.
  - Sábado 09:00-14:00 com horários livres; domingo sem atendimento; horários passados do dia atual bloqueados.
  - Privacidade: com a chave pública, clientes, agendamentos, vínculos de usuários, perfis, planos, bloqueios e notificações retornam vazio; apenas estabelecimento, serviços e profissionais são legíveis.
  - Autenticação: cadastro exibe aviso de confirmação de e-mail; `/dashboard` sem sessão redireciona para `/auth`; login válido abre o painel; onboarding criou estabelecimento com o usuário como admin; cadastro de serviço gravado e listado.
  - Typecheck do projeto sem erros. Dados de teste removidos ao final.
- **Problemas encontrados**: a disponibilidade de "qualquer profissional" marcava como ocupado um horário livre para outro profissional — corrigido combinando as agendas individuais.
- **Pendências relacionadas**: edição de horários, exceções e bloqueios pela tela; convite de profissionais para a equipe; gestão de planos de clientes na interface; login social; notificações, pagamentos e WhatsApp (fora do escopo).

## 2026-09-11 (3)
- **Objetivo da alteração**: Tornar a agenda pública reutilizável por qualquer estabelecimento, sem depender do slug fixo da barbearia de demonstração.
- **Funcionalidades implementadas**:
  - `/schedule` agora aceita o parâmetro opcional `slug`.
  - O loader e as chamadas de disponibilidade/agendamento usam o slug recebido, mantendo a barbearia de demonstração como fallback para links antigos.
  - O link público exibido em Configurações agora aponta para o slug real do estabelecimento e pode ser aberto em nova aba ou copiado.
- **Arquivos alterados**: `src/routes/schedule.tsx`, `src/routes/_authenticated/dashboard/settings.tsx`, `CHANGELOG.md`.
- **Testes realizados**: validação estrutural da alteração no código e preservação do fluxo existente.
- **Problemas encontrados**: nenhum conhecido nesta etapa.
- **Pendências relacionadas**: rota amigável dedicada; gestão de horários pela tela.

## 2026-09-11 (4)
- **Objetivo da alteração**: Liberar a gestão do expediente geral diretamente pelo painel do estabelecimento e permitir fechamentos em datas específicas.
- **Funcionalidades implementadas**:
  - Edição dos horários gerais de domingo a sábado.
  - Múltiplos intervalos por dia.
  - Fechamentos e horários especiais por data.
  - Persistência de horários e exceções no banco sob RLS.
- **Arquivos alterados**: `src/routes/_authenticated/dashboard/settings.tsx`, `CHANGELOG.md`, `PROJECT_STATUS.md`.
- **Testes realizados**: validação estrutural e conferência das tabelas relacionadas.
- **Problemas encontrados**: nenhum conhecido nesta etapa.
- **Pendências relacionadas**: agenda individual por profissional.

## 2026-09-11 (5)
- **Objetivo da alteração**: Consolidar diretamente no código o núcleo restante do MVP e aplicar regras de negócio pendentes sem consumir créditos do Lovable.
- **Funcionalidades implementadas**:
  - Agenda individual por profissional.
  - Gestão de planos de clientes.
  - Bloqueios gerais e por profissional.
  - Exceções com horário especial.
  - Regras de plano no agendamento.
  - Correções de overrides individuais.
- **Arquivos alterados**: módulos de scheduling, telas de profissionais, clientes, agendamentos, configurações, `CHANGELOG.md` e `PROJECT_STATUS.md`.
- **Testes realizados**: revisão estrutural das integrações e persistência.
- **Problemas encontrados**: correção do filtro de agendas individuais inativas.
- **Pendências relacionadas**: equipe, URL amigável, identidade do estabelecimento, login social, IA, notificações, pagamentos e WhatsApp.

## 2026-09-12 (6)
- **Objetivo da alteração**: Corrigir a experiência pública de calendário para trabalhar com a data do estabelecimento e elevar a apresentação inicial do produto.
- **Funcionalidades implementadas**: cálculo de datas sensível ao fuso, acessibilidade básica e nova homepage comercial.
- **Arquivos alterados**: `src/lib/scheduling/format.ts`, `src/routes/schedule.tsx`, `src/routes/index.tsx`, `CHANGELOG.md`, `PROJECT_STATUS.md`.
- **Testes realizados**: revisão estrutural.
- **Problemas encontrados**: deslocamentos de data em UTC corrigidos.
- **Pendências relacionadas**: rota amigável, perfil, equipe e integrações futuras.

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
- **Problemas encontrados**: corrigida interação entre fechamento geral e horário especial específico.
- **Pendências relacionadas**: rota amigável, equipe, perfil e integrações futuras.

## 2026-09-12 (9)
- **Objetivo da alteração**: Criar uma área dedicada para administrar a identidade e os dados públicos do estabelecimento.
- **Funcionalidades implementadas**: rota `/dashboard/profile`, edição de dados comerciais, identidade visual e URL da logo; acesso restrito para edição a administradores.
- **Arquivos alterados**: `src/routes/_authenticated/dashboard/profile.tsx`, `src/routes/_authenticated/dashboard/route.tsx`, `src/routeTree.gen.ts`, `CHANGELOG.md`.
- **Testes realizados**: revisão estrutural.
- **Problemas encontrados**: nenhum conhecido.
- **Pendências relacionadas**: URL amigável, equipe e integrações futuras.

## 2026-09-12 (10)
- **Objetivo da alteração**: Criar uma URL pública amigável para o agendamento sem quebrar links legados.
- **Funcionalidades implementadas**: `/agenda/{slug}`, componente compartilhado de booking, redirecionamento da rota legada e metadados básicos de SEO.
- **Arquivos alterados**: `src/routes/schedule.tsx`, `src/routeTree.gen.ts`, `CHANGELOG.md`; novos componentes e rota dinâmica de agenda.
- **Testes realizados**: revisão estrutural.
- **Problemas encontrados**: nenhum conhecido.
- **Pendências relacionadas**: equipe, login social, IA, notificações, pagamentos e WhatsApp.

## 2026-09-12 (11)
- **Objetivo da alteração**: Adicionar verificação contínua de qualidade ao repositório.
- **Funcionalidades implementadas**: GitHub Actions para TypeScript, ESLint e build em PRs e pushes para `main`.
- **Arquivos alterados**: `.github/workflows/ci.yml`, `CHANGELOG.md`, `PROJECT_STATUS.md`.
- **Testes realizados**: pipeline configurado para validar automaticamente novas alterações.
- **Problemas encontrados**: nenhum conhecido.
- **Pendências relacionadas**: equipe, login social, IA, notificações, pagamentos e WhatsApp.

## 2026-09-12 (12)
- **Objetivo da alteração**: Implementar o gerenciamento de acesso da equipe sem criar uma nova tabela de convites.
- **Funcionalidades implementadas**:
  - Nova página `/dashboard/team` para administradores.
  - Convite de profissional por e-mail usando a autenticação administrativa do Supabase no servidor.
  - Usuário convidado é associado ao registro do profissional por `professionals.user_id`.
  - Membership `professional` criada/atualizada em `establishment_users`.
  - Remoção do acesso desassocia o profissional e remove apenas o vínculo daquele estabelecimento, sem apagar a conta do usuário.
  - Proteção server-side: somente admin do estabelecimento pode executar convite ou remoção.
  - Novo item "Equipe" na navegação do dashboard.
  - Rota registrada no `routeTree.gen.ts`.
- **Arquivos alterados**: `src/routes/_authenticated/dashboard/route.tsx`, `src/routeTree.gen.ts`, `CHANGELOG.md`; novos: `src/routes/_authenticated/dashboard/team.tsx`, `src/lib/auth/team.functions.ts`.
- **Testes realizados**: revisão estrutural do fluxo de autenticação, vínculo profissional-usuário e isolamento por estabelecimento; sem alteração de schema do banco.
- **Problemas encontrados**: nenhum conhecido nesta etapa.
- **Pendências relacionadas**: mostrar ao profissional somente a agenda correspondente ao seu próprio perfil; login social; IA; notificações reais; pagamentos e WhatsApp.
