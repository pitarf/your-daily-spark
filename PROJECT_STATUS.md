# Status do Projeto

## Funcionalidades Concluídas ✅
- **Banco de dados multi-tenant**: 16 tabelas em produção (`establishments`, `profiles`, `establishment_users`, `professionals`, `services`, `professional_services`, `weekly_schedules`, `schedule_breaks`, `schedule_exceptions`, `customers`, `customer_plans`, `customer_plan_services`, `customer_plan_assignments`, `appointments`, `blocked_slots`, `notifications`) com UUIDs, FKs, índices e `updated_at` automático.
- **Regras de segurança (RLS)**: ativas em todas as tabelas, com isolamento por estabelecimento e leitura pública somente de dados não sensíveis.
- **Proteção contra conflitos**: agendamentos sobrepostos do mesmo profissional e conflitos com bloqueios são rejeitados pelo banco.
- **Dados de demonstração**: Barbearia Marca Minha Vez com 4 serviços, 2 profissionais e agenda semanal configurada.
- **Motor de disponibilidade** (`src/lib/scheduling/availability.ts`): respeita fuso, intervalos, exceções, bloqueios, duração do serviço e overrides individuais.
- **Exceções específicas**: uma exceção `custom_hours` do profissional prevalece deterministamente sobre a exceção geral do estabelecimento.
- **Agendamento público** (`src/routes/schedule.tsx`): serviço, profissional ou "qualquer profissional", data, horário, dados do cliente, revisão e confirmação, com validação no servidor.
- **Agenda pública por estabelecimento**: `/schedule?slug={slug}`.
- **Calendário público sensível ao fuso**: hoje, próximos dias e data mínima são calculados no timezone do estabelecimento.
- **Autenticação**: entrar, criar conta, recuperar senha e proteção do `/dashboard`.
- **Onboarding**: criação de estabelecimento e vínculo inicial do administrador.
- **Painel do estabelecimento**: visão geral, agenda, serviços, profissionais, clientes e configurações com dados reais.
- **Gestão de expediente geral**: dias ativos, início/fim, múltiplos intervalos e exceções.
- **Gestão de agenda individual**: horários próprios, intervalos e folgas por profissional.
- **Serviços e profissionais**: CRUD e vínculos profissional-serviço.
- **Clientes e planos**: cadastro, planos, serviços permitidos, limite de duração e validade do vínculo.
- **Regras de plano no agendamento**: validação server-side usando o cliente identificado pelo telefone.
- **Bloqueios e status**: bloqueios gerais/individuais e ciclo de status dos agendamentos.
- **Homepage comercial**: apresentação do produto, benefícios, fluxo e CTAs.
- **Acessibilidade básica na agenda**: estados selecionados, rótulos e mensagens de erro acessíveis.

## Em Desenvolvimento 🟡
- **Equipe**: convite e vínculo de profissionais a contas de usuário.
- **URL amigável**: `/agenda/{slug}`.
- **Perfil/identidade do estabelecimento**: ampliar edição de dados comerciais e identidade visual no painel.

## Pendente 🔴
- **Login social**.
- **IA para configuração e consulta da agenda**.
- **Notificações reais** por e-mail/WhatsApp/SMS.
- **Pagamentos e planos de assinatura da plataforma SaaS**.
- **Integração oficial com WhatsApp**.

## Bloqueado ⚠️
- Nenhum no momento.

---
*Última atualização: 2026-09-12*
