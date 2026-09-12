# Status do Projeto

## Funcionalidades Concluídas ✅
- **Banco de dados multi-tenant**: 16 tabelas em produção (`establishments`, `profiles`, `establishment_users`, `professionals`, `services`, `professional_services`, `weekly_schedules`, `schedule_breaks`, `schedule_exceptions`, `customers`, `customer_plans`, `customer_plan_services`, `customer_plan_assignments`, `appointments`, `blocked_slots`, `notifications`) com UUIDs, FKs, índices e `updated_at` automático.
- **Regras de segurança (RLS)**: ativas em todas as tabelas. Acesso restrito ao estabelecimento do usuário; leitura pública apenas de informações não sensíveis (estabelecimento ativo, serviços, profissionais e horários de funcionamento).
- **Proteção contra conflitos**: agendamentos sobrepostos do mesmo profissional e conflitos com bloqueios são rejeitados pelo banco.
- **Dados de demonstração**: Barbearia Marca Minha Vez com 4 serviços, 2 profissionais e agenda semanal com intervalo.
- **Motor de disponibilidade** (`src/lib/scheduling/availability.ts`): respeita fuso do estabelecimento, intervalos, exceções, bloqueios, duração do serviço e overrides de agenda individual.
- **Agendamento pela página pública** (`src/routes/schedule.tsx`): serviço, profissional ou "qualquer profissional", dia, horário, dados do cliente, revisão e confirmação, com revalidação no servidor.
- **Agenda pública por estabelecimento**: `/schedule?slug={slug}` carrega dados e disponibilidade do estabelecimento indicado.
- **Autenticação de usuários**: entrar, criar conta e recuperar senha (`/auth`, `/reset-password`) usando o serviço de autenticação do Lovable Cloud.
- **Painel do estabelecimento** (`/dashboard`): rota protegida com visão geral, agenda do dia, serviços, profissionais, clientes e configurações, lendo e gravando dados reais.
- **Onboarding**: criar estabelecimento ou assumir a barbearia de demonstração quando disponível.
- **Link público no painel**: Configurações mostra o link gerado pelo slug do estabelecimento, com abertura em nova aba e cópia.
- **Gestão do expediente geral**: administrador pode ativar/desativar dias, alterar início/fim e adicionar, editar ou remover múltiplos intervalos.
- **Exceções da agenda**: administrador pode cadastrar e remover fechamentos de datas específicas e horários especiais personalizados.
- **Profissionais**: cadastro/edição, ativação e vinculação aos serviços.
- **Agenda individual do profissional**: cada profissional pode ter horários, intervalos e dias de folga próprios; uma configuração específica substitui o expediente geral naquele dia.
- **Clientes e planos**: cadastro automático de clientes pelos agendamentos, gestão de planos, limite de duração, serviços permitidos e vínculo de plano ao cliente.
- **Regras de plano no agendamento público**: serviço e duração são validados no servidor conforme o plano ativo do cliente identificado pelo telefone.
- **Gestão de bloqueios**: painel permite bloquear período para todos os profissionais ou para um profissional específico e remover bloqueios.
- **Gestão de status dos agendamentos**: painel permite alterar entre pendente, confirmado, concluído, cancelado e não compareceu.
- **Calendário público sensível ao fuso**: datas de hoje, próximos dias e data mínima são calculadas no timezone do estabelecimento, evitando deslocamentos causados por UTC.
- **Homepage comercial**: apresentação do produto, benefícios, fluxo de uso e CTAs para agenda e criação de estabelecimento.

## Em Desenvolvimento 🟡
- **Equipe**: convite/vínculo de profissionais a contas de usuário para que cada profissional tenha acesso próprio ao painel.
- **Refinamento da experiência pública**: rota amigável dedicada `/agenda/{slug}` em vez de apenas query string.
- **Edição completa do perfil do estabelecimento**: nome, identidade visual e dados comerciais editáveis pelo painel.

## Pendente 🔴
- **Login social** (Google/Apple), além de e-mail e senha.
- **IA para configuração e consulta da agenda**.
- **Notificações reais** por e-mail/WhatsApp/SMS.
- **Pagamentos e planos de assinatura da plataforma SaaS**.
- **Integração oficial com WhatsApp**.

## Bloqueado ⚠️
- Nenhum no momento.

---
*Última atualização: 2026-09-12*
