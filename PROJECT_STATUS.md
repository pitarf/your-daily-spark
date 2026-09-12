# Status do Projeto

## Funcionalidades Concluídas ✅
- Banco de dados multi-tenant com 16 tabelas, FKs, índices e `updated_at` automático.
- RLS ativo em todas as tabelas, com isolamento por estabelecimento.
- Proteção de banco contra horários sobrepostos e conflitos com bloqueios.
- Dados de demonstração da Barbearia Marca Minha Vez.
- Motor de disponibilidade com fuso, intervalos, exceções, bloqueios, duração e agenda individual.
- Precedência determinística das exceções: fechamento individual > horário especial individual > fechamento geral > horário especial geral > agenda semanal.
- Agendamento público com serviço, profissional/qualquer profissional, data, horário, cliente, revisão e confirmação, validado no servidor.
- Agenda pública reutilizável por estabelecimento.
- URL amigável da agenda: `/agenda/{slug}` com compatibilidade automática com `/schedule?slug={slug}`.
- Calendário público sensível ao fuso do estabelecimento.
- Autenticação por e-mail, cadastro e recuperação de senha.
- Dashboard protegido com agenda, serviços, profissionais, clientes e configurações.
- Onboarding de estabelecimento.
- Gestão de expediente geral, múltiplos intervalos e exceções.
- Gestão de agenda individual por profissional.
- Gestão de serviços, profissionais, clientes e planos.
- Regras de plano aplicadas no agendamento.
- Gestão de bloqueios e status dos agendamentos.
- Homepage comercial e fluxo público acessível.
- Acessibilidade básica na agenda pública.
- Perfil do estabelecimento com edição de dados comerciais e identidade, incluindo logo.
- CI de qualidade: GitHub Actions executa TypeScript, ESLint e build de produção em PRs e pushes para `main`.
- **Equipe**: administradores podem convidar profissionais por e-mail, vincular contas existentes e remover o acesso sem apagar a conta.

## Em Desenvolvimento 🟡
- Restringir a visão do painel de profissionais à própria agenda e aos próprios dados quando o usuário tiver papel `professional`.

## Pendente 🔴
- Login social.
- IA para configurar e consultar a agenda.
- Notificações reais por e-mail, WhatsApp e SMS.
- Pagamentos e planos de assinatura da plataforma SaaS.
- Integração oficial com WhatsApp.

## Bloqueado ⚠️
- Nenhum no momento.

---
*Última atualização: 2026-09-12*
