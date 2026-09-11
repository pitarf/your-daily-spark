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
  - Privacidade: com a chave pública, clientes, agendamentos, vínculos de usuários, perfis, planos, bloqueios e notificações retornam vazio; apenas estabelecimento, serviços, profissionais e horários são legíveis.
  - Autenticação: cadastro exibe aviso de confirmação de e-mail; `/dashboard` sem sessão redireciona para `/auth`; login válido abre o painel; onboarding criou estabelecimento com o usuário como admin; cadastro de serviço gravado e listado.
  - Typecheck do projeto sem erros. Dados de teste removidos ao final.
- **Problemas encontrados**: a disponibilidade de "qualquer profissional" marcava como ocupado um horário livre para outro profissional — corrigido combinando as agendas individuais.
- **Pendências relacionadas**: edição de horários, exceções e bloqueios pela tela; convite de profissionais para a equipe; gestão de planos de clientes na interface; login social; notificações, pagamentos e WhatsApp (fora do escopo).
