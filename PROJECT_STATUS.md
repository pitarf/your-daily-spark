# Status do Projeto

## Funcionalidades Concluídas ✅
- Banco de dados multi-tenant com 16 tabelas, FKs, índices e `updated_at` automático.
- RLS ativo em todas as tabelas, com isolamento por estabelecimento e escopos adicionais para profissionais.
- Proteção de banco contra horários sobrepostos e conflitos com bloqueios.
- Dados de demonstração da Barbearia Marca Minha Vez.
- Motor de disponibilidade com fuso, intervalos, exceções, bloqueios, duração e agenda individual.
- Precedência determinística das exceções: fechamento individual > horário especial individual > fechamento geral > horário especial geral > agenda semanal.
- Agendamento público com serviço, profissional/qualquer profissional, data, horário, cliente, revisão e confirmação, validado no servidor.
- Agenda pública reutilizável por estabelecimento.
- URL amigável da agenda: `/agenda/{slug}` com compatibilidade automática com `/schedule?slug={slug}`.
- Calendário público sensível ao fuso do estabelecimento.
- Autenticação por e-mail, cadastro e recuperação de senha.
- Login social com Google preparado na interface, pendente apenas da habilitação do provedor no ambiente de autenticação.
- Dashboard protegido com agenda, serviços, profissionais, clientes e configurações.
- Controle de acesso por papel para impedir que profissionais naveguem nas áreas administrativas.
- Painel do profissional com os próprios atendimentos.
- Onboarding de estabelecimento.
- Gestão de expediente geral, múltiplos intervalos e exceções.
- Gestão de agenda individual por profissional.
- Gestão de serviços, profissionais, clientes e planos.
- Regras de plano aplicadas no agendamento.
- Gestão de bloqueios e status dos agendamentos.
- Agenda administrativa com visualizações Dia, Semana e Mês.
- Agendamento manual pelo administrador usando o mesmo motor de disponibilidade.
- Homepage comercial e fluxo público acessível.
- Acessibilidade básica na agenda pública.
- Perfil do estabelecimento com edição de dados comerciais e identidade, incluindo logo.
- Gestão de equipe: convite de profissionais por e-mail, vínculo de contas existentes e remoção de acesso sem apagar a conta.
- CI de qualidade com TypeScript, ESLint e build de produção em GitHub Actions.
- Último pipeline validado com sucesso após os ajustes de qualidade.

## Em Desenvolvimento 🟡
- Refinamentos finais de UX, identidade por tipo de negócio e preparação de publicação.

## Pendente 🔴
- Habilitar o provedor Google no ambiente de autenticação.
- IA para configurar e consultar a agenda.
- Notificações reais por e-mail, WhatsApp e SMS.
- Pagamentos e planos de assinatura da plataforma SaaS.
- Integração oficial com WhatsApp.
- Agendamento com duração personalizada independente de um serviço pré-cadastrado.

## Bloqueado ⚠️
- Nenhum no momento.

---
*Última atualização: 2026-09-12*
