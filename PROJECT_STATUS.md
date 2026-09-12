# Status do Projeto

## Funcionalidades Concluídas ✅
- Banco de dados multi-tenant com 16 tabelas, FKs, índices e `updated_at` automático.
- RLS ativo em todas as tabelas, com isolamento por estabelecimento.
- Proteção de banco contra horários sobrepostos e conflitos com bloqueios.
- Dados de demonstração da Barbearia Marca Minha Vez.
- Motor de disponibilidade em `src/lib/scheduling/availability.ts`, com fuso, intervalos, exceções, bloqueios, duração e agenda individual.
- Precedência determinística das exceções: fechamento individual > horário especial individual > fechamento geral > horário especial geral > agenda semanal.
- Agendamento público com serviço, profissional/qualquer profissional, data, horário, cliente, revisão e confirmação, validado no servidor.
- Agenda pública por slug via `/schedule?slug={slug}`.
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
- **Perfil do estabelecimento**: rota `/dashboard/profile` com edição, para administradores, de nome, descrição, tipo de negócio, fuso horário, telefone, WhatsApp, e-mail, endereço e URL da logo.
- Pré-visualização da logo e atalho para a agenda pública.

## Em Desenvolvimento 🟡
- Equipe: convite e vínculo de profissionais a contas de usuário.
- URL amigável dedicada: `/agenda/{slug}`.

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
