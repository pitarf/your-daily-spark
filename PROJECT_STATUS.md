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
- Gestão de planos de clientes no dashboard, com nome, descrição, duração máxima, ativação/desativação e serviços permitidos.
- Atribuição de planos aos clientes pelo painel de clientes.
- Homepage comercial e fluxo público acessível.
- Acessibilidade básica na agenda pública.
- Perfil do estabelecimento com edição de dados comerciais e identidade, incluindo logo.
- Gestão de equipe: convite de profissionais por e-mail, vínculo de contas existentes e remoção de acesso sem apagar a conta.
- CI de qualidade com TypeScript, ESLint e build de produção em GitHub Actions.
- Migração versionada das regras RLS restritivas de escopo profissional.
- Base de duração personalizada versionada no banco, com `allow_custom_duration` e `duration_minutes_override`.
- Fluxo público de agendamento personalizado por serviço, com duração de 15 minutos a 4 horas em múltiplos de 15, respeitando profissionais, agenda, intervalos, exceções, bloqueios e conflitos no servidor.
- Fluxo personalizado consolidado na rota pública `/agenda/{slug}?custom=true`, evitando uma segunda rota dinâmica e mantendo o route tree estável.
- Verificação do banco do ambiente Lovable: a Barbearia Marca Minha Vez está com `allow_custom_duration = true`.
- Pipeline final da etapa de duração personalizada validou TypeScript, ESLint e build de produção com sucesso.
- Agendamento avulso personalizado sem serviço cadastrado, com título do atendimento, duração de 15 minutos a 4 horas, profissional opcional, observações e validação server-side.
- Restrição no banco para impedir atendimento sem serviço e sem título personalizado.
- Tema visual adaptativo na agenda pública conforme o tipo de negócio: barbearia, salão, nail designer, sobrancelhas, estética, clínica, consultório, tatuagem e outro.
- Apresentação administrativa de atendimentos avulsos sem serviço, exibindo título personalizado, preço quando definido e duração no calendário Dia, Semana e Mês.
- Painel do profissional exibe corretamente atendimentos avulsos sem serviço, usando o título personalizado e a duração cadastrada.
- Administrador pode ativar/desativar o agendamento personalizado no perfil do estabelecimento.
- Link público principal do painel utiliza a rota amigável `/agenda/{slug}`.
- README atualizado para refletir o produto Marca Minha Vez, sua arquitetura, rotas, desenvolvimento e roadmap.
- Agenda pública oculta as opções de duração personalizada e atendimento avulso quando o estabelecimento desativa o recurso.
- Tentativas diretas de acessar `?custom=true` ou `?standalone=true` quando o recurso está desativado recebem mensagem de indisponibilidade e retorno para a agenda.
- Dashboard inicial exibe atendimentos avulsos com título personalizado em vez de apresentar um serviço genérico ausente.
- Painel do profissional classifica “Hoje” usando a data local do estabelecimento, evitando erros de dia causados por timestamps UTC.

## Em Desenvolvimento 🟡
- Refinamentos finais de UX e identidade visual por tipo de negócio.
- Melhorias de experiência no fluxo de agendamento e administração.

## Pendente 🔴
- Habilitar o provedor Google no ambiente de autenticação.
- IA para configurar e consultar a agenda.
- Notificações reais por e-mail, WhatsApp e SMS.
- Pagamentos e planos de assinatura da plataforma SaaS.
- Integração oficial com WhatsApp.

## Bloqueado ⚠️
- Nenhum no momento.

---
*Última atualização: 2026-09-12*