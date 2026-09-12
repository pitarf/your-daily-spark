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
  - `/schedule` agora aceita o parâmetro opcional `slug` na URL.
  - O loader e as chamadas de disponibilidade/agendamento usam o slug recebido, mantendo a barbearia de demonstração como fallback para links antigos.
  - O link público exibido em Configurações agora aponta para o slug real do estabelecimento e pode ser aberto em nova aba ou copiado.
- **Arquivos alterados**: `src/routes/schedule.tsx`, `src/routes/_authenticated/dashboard/settings.tsx`, `CHANGELOG.md`.
- **Testes realizados**: validação estrutural da alteração no código e preservação do fluxo existente; ainda é necessário validar o build/typecheck no ambiente de execução.
- **Problemas encontrados**: nenhum conhecido nesta etapa.
- **Pendências relacionadas**: criação de uma rota amigável dedicada como `/agenda/{slug}` continua planejada; gestão de horários pela tela ainda não implementada.

## 2026-09-11 (4)
- **Objetivo da alteração**: Liberar a gestão do expediente geral diretamente pelo painel do estabelecimento e permitir fechamentos em datas específicas.
- **Funcionalidades implementadas**:
  - Edição dos horários gerais de domingo a sábado, com ativação/desativação de cada dia.
  - Edição do início e fim do expediente.
  - Suporte visual a múltiplos intervalos por dia, com inclusão, edição e remoção.
  - Validações no cliente para impedir expediente inválido e intervalos fora da janela de atendimento antes do envio ao banco.
  - Persistência dos horários e intervalos em `weekly_schedules` e `schedule_breaks`, respeitando RLS de administrador.
  - Cadastro e remoção de exceções de fechamento em datas específicas usando `schedule_exceptions` com `type = closed`.
  - Agendas específicas de profissionais continuam separadas e não são sobrescritas pelo editor do expediente geral.
- **Arquivos alterados**: `src/routes/_authenticated/dashboard/settings.tsx`, `CHANGELOG.md`, `PROJECT_STATUS.md`.
- **Testes realizados**: validação estrutural do código e conferência da modelagem SQL existente para `weekly_schedules`, `schedule_breaks` e `schedule_exceptions`; build/typecheck ainda precisa ser executado no ambiente do projeto.
- **Problemas encontrados**: nenhum conhecido nesta etapa.
- **Pendências relacionadas**: edição de horários individuais de profissionais; exceções com horário personalizado; convite de profissionais para a equipe; gestão de planos de clientes; rota amigável `/agenda/{slug}`.

## 2026-09-11 (5)
- **Objetivo da alteração**: Consolidar diretamente no código o núcleo restante do MVP e aplicar as regras de negócio pendentes sem consumir créditos do Lovable.
- **Funcionalidades implementadas**:
  - Agenda individual por profissional no painel, com dias ativos/inativos, horários próprios e múltiplos intervalos.
  - Override de agenda individual, permitindo que um profissional tenha um dia de folga sem alterar o expediente geral do estabelecimento.
  - Gestão de planos de clientes na interface, com criação/edição, limite máximo de duração e serviços permitidos.
  - Vínculo de plano ativo ao cliente com validade opcional.
  - Bloqueios de agenda pelo painel, para todos os profissionais ou para um profissional específico.
  - Exceções de agenda com horário especial personalizado, além do fechamento de dia inteiro.
  - Regras de plano aplicadas no servidor durante a criação do agendamento, validando serviço permitido e duração máxima pelo cliente identificado por telefone.
  - Correção da leitura das agendas individuais no servidor para incluir linhas inativas usadas como overrides de folga.
  - Validação defensiva do horário recebido pelo endpoint antes de convertê-lo para ISO.
- **Arquivos alterados**: `src/lib/scheduling/scheduling.functions.ts`, `src/lib/scheduling/availability.ts`, `src/routes/_authenticated/dashboard/professionals.tsx`, `src/routes/_authenticated/dashboard/customers.tsx`, `src/routes/_authenticated/dashboard/appointments.tsx`, `src/routes/_authenticated/dashboard/settings.tsx`, `CHANGELOG.md`, `PROJECT_STATUS.md`.
- **Testes realizados**: revisão estrutural das integrações entre interface, banco e motor de disponibilidade; conferência das queries e regras de persistência existentes. O repositório não possui checks automáticos configurados para este commit, portanto build/typecheck automatizado não foi executado nesta rodada.
- **Problemas encontrados**: havia um ponto em que a leitura da agenda do servidor filtrava apenas linhas ativas, o que impediria um override individual inativo de representar folga; corrigido.
- **Pendências relacionadas**: convite/vínculo de profissionais a contas de usuário; rota amigável `/agenda/{slug}`; edição completa do perfil/identidade do estabelecimento; login social; IA; notificações; pagamentos e WhatsApp.

## 2026-09-12 (6)
- **Objetivo da alteração**: Corrigir a experiência pública de calendário para trabalhar com a data do estabelecimento, e não com a data UTC/local do navegador, e elevar a apresentação inicial do produto.
- **Funcionalidades implementadas**:
  - Adicionada `addDaysInTimezone` para cálculos de datas de calendário no fuso do estabelecimento.
  - `/schedule` passou a calcular hoje, datas futuras e data mínima usando o fuso configurado para o estabelecimento.
  - Melhorias de acessibilidade na seleção de serviços, profissionais e horários (`aria-pressed`, `aria-label`, `role="alert"`).
  - Melhor orientação visual na grade de horários, explicando o significado dos horários indisponíveis.
  - Homepage substituída por uma apresentação real do Marca Minha Vez, com proposta de valor, benefícios, fluxo de uso e CTAs para agenda e criação de estabelecimento.
- **Arquivos alterados**: `src/lib/scheduling/format.ts`, `src/routes/schedule.tsx`, `src/routes/index.tsx`, `CHANGELOG.md`, `PROJECT_STATUS.md`.
- **Testes realizados**: revisão estrutural das funções de calendário e conferência das integrações afetadas; build/typecheck automático continua indisponível por ausência de pipeline configurado no repositório.
- **Problemas encontrados**: `todayIso()` e `nextDays()` usavam `toISOString()` diretamente, o que poderia deslocar a data do calendário em viradas de dia ou estabelecimentos com outro fuso; corrigido.
- **Pendências relacionadas**: rota amigável `/agenda/{slug}`; edição completa do perfil/identidade do estabelecimento; equipe; login social; IA; notificações reais; pagamentos e WhatsApp.

## 2026-09-12 (7)
- **Objetivo da alteração**: Corrigir a precedência de exceções personalizadas quando existe uma exceção geral e outra específica para o mesmo profissional e data.
- **Funcionalidades implementadas**:
  - Exceção `custom_hours` específica do profissional agora vence explicitamente a exceção geral do estabelecimento.
  - A lógica deixou de depender de ordenação por comparação booleana, tornando a regra determinística.
- **Arquivos alterados**: `src/lib/scheduling/availability.ts`, `CHANGELOG.md`.
- **Testes realizados**: revisão estrutural do motor de disponibilidade e conferência da regra de precedência.
- **Problemas encontrados**: a seleção anterior podia escolher uma exceção personalizada incorreta quando havia mais de uma aplicável.
- **Pendências relacionadas**: rota amigável `/agenda/{slug}`; equipe; edição completa do perfil/identidade do estabelecimento; login social; IA; notificações reais; pagamentos e WhatsApp.

## 2026-09-12 (8)
- **Objetivo da alteração**: Completar a precedência das exceções de agenda para tratar corretamente combinações entre fechamento geral, horário especial geral, fechamento individual e horário especial individual.
- **Funcionalidades implementadas**:
  - Fechamento específico do profissional passa a ter prioridade máxima.
  - Horário especial específico do profissional pode substituir explicitamente um fechamento geral.
  - Fechamento geral continua vencendo o horário especial geral quando não existe override específico.
  - A regra agora é expressa diretamente no motor de disponibilidade, sem depender da ordenação incidental das exceções.
- **Arquivos alterados**: `src/lib/scheduling/availability.ts`, `CHANGELOG.md`.
- **Testes realizados**: revisão estrutural da matriz de precedência do motor de disponibilidade.
- **Problemas encontrados**: a correção anterior ainda permitia que um fechamento geral encerrasse a disponibilidade antes de avaliar um horário especial específico do profissional.
- **Pendências relacionadas**: rota amigável `/agenda/{slug}`; equipe; edição completa do perfil/identidade do estabelecimento; login social; IA; notificações reais; pagamentos e WhatsApp.
