# Status do Projeto

## Funcionalidades Concluídas ✅
- **Banco de dados multi-tenant**: 16 tabelas em produção (`establishments`, `profiles`, `establishment_users`, `professionals`, `services`, `professional_services`, `weekly_schedules`, `schedule_breaks`, `schedule_exceptions`, `customers`, `customer_plans`, `customer_plan_services`, `customer_plan_assignments`, `appointments`, `blocked_slots`, `notifications`) com UUIDs, FKs, índices e `updated_at` automático.
- **Regras de segurança (RLS)**: ativas em todas as tabelas. Acesso restrito ao estabelecimento do usuário; leitura pública apenas de informações não sensíveis (estabelecimento ativo, serviços, profissionais e horários de funcionamento).
- **Proteção contra conflitos**: agendamentos sobrepostos do mesmo profissional e conflitos com bloqueios são rejeitados pelo banco (validado por teste).
- **Dados de demonstração**: Barbearia Marca Minha Vez com 4 serviços, 2 profissionais e agenda semanal com intervalo.
- **Motor de disponibilidade** (`src/lib/scheduling/availability.ts`): respeita fuso do estabelecimento, intervalos, exceções, bloqueios e duração do serviço.
- **Página de agendamento** (`src/routes/schedule.tsx`): lê dados reais do banco e mostra horários livres/indisponíveis.
- **Página inicial** e páginas de planos/configurações do estabelecimento (estáticas).

## Em Desenvolvimento 🟡
- **Criação de agendamento pela interface** (o banco já suporta; falta o fluxo de confirmação do cliente).
- **Painéis do estabelecimento**: gestão de serviços, profissionais, agenda, clientes e planos ainda são telas estáticas.

## Pendente 🔴
- **Autenticação de usuários** (login/cadastro, papéis admin/profissional e rotas protegidas). A base no banco já está pronta (`profiles`, `establishment_users`, papéis).
- **Notificações reais, pagamentos e WhatsApp** (fora do escopo desta etapa).
- **Exceções de agenda e bloqueios pela interface**.

## Bloqueado ⚠️
- Nenhum no momento.

---
*Última atualização: 2026-09-11*
