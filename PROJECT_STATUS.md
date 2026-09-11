# Status do Projeto

## Funcionalidades Concluídas ✅
- **Banco de dados multi-tenant**: 16 tabelas em produção (`establishments`, `profiles`, `establishment_users`, `professionals`, `services`, `professional_services`, `weekly_schedules`, `schedule_breaks`, `schedule_exceptions`, `customers`, `customer_plans`, `customer_plan_services`, `customer_plan_assignments`, `appointments`, `blocked_slots`, `notifications`) com UUIDs, FKs, índices e `updated_at` automático.
- **Regras de segurança (RLS)**: ativas em todas as tabelas. Acesso restrito ao estabelecimento do usuário; leitura pública apenas de informações não sensíveis (estabelecimento ativo, serviços, profissionais e horários de funcionamento) — validado com a chave pública.
- **Proteção contra conflitos**: agendamentos sobrepostos do mesmo profissional e conflitos com bloqueios são rejeitados pelo banco (validado por teste).
- **Dados de demonstração**: Barbearia Marca Minha Vez com 4 serviços, 2 profissionais e agenda semanal com intervalo.
- **Motor de disponibilidade** (`src/lib/scheduling/availability.ts`): respeita fuso do estabelecimento, intervalos, exceções, bloqueios e duração do serviço.
- **Agendamento pela página pública** (`src/routes/schedule.tsx`): serviço, profissional (ou "qualquer profissional"), dia, horário, dados do cliente, revisão e confirmação, com revalidação completa no servidor.
- **Agenda pública por estabelecimento**: `/schedule?slug={slug}` carrega dados e disponibilidade do estabelecimento indicado, mantendo `/schedule` como fallback para a barbearia de demonstração.
- **Autenticação de usuários**: entrar, criar conta e recuperar senha (`/auth`, `/reset-password`) usando o serviço de autenticação do Lovable Cloud.
- **Painel do estabelecimento** (`/dashboard`): rota protegida com visão geral, agenda do dia, serviços, profissionais, clientes e configurações, lendo e gravando dados reais.
- **Onboarding**: criar estabelecimento (o criador vira admin) ou assumir a barbearia de demonstração quando ela ainda não tem responsável.
- **Link público no painel**: Configurações mostra o link gerado pelo slug do estabelecimento, com abertura em nova aba e cópia para a área de transferência.

## Em Desenvolvimento 🟡
- **Gestão de agenda pela tela**: edição de horários de funcionamento, exceções (feriados) e bloqueios ainda só existem no banco.
- **Equipe**: convidar profissionais para acessar o painel e ligar cada profissional a um usuário.
- **Planos de clientes**: já existem no banco, sem tela de gestão.

## Pendente 🔴
- **Rota amigável dedicada** (`/agenda/{slug}`) em vez do parâmetro de query atual.
- **Login social** (Google/Apple) — hoje apenas e-mail e senha.
- **Notificações reais, pagamentos e WhatsApp** (fora do escopo desta etapa).

## Bloqueado ⚠️
- Nenhum no momento.

---
*Última atualização: 2026-09-11*
