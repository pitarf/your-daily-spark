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
- **Objetivo da alteração**: Iniciar a fundação funcional do motor de agendamento do Marca Minha Vez, preservando a stack existente.
- **Funcionalidades implementadas**:
  - Tipos de domínio para horários, reservas, bloqueios e disponibilidade.
  - Primeiro motor puro de cálculo de horários disponíveis.
  - Consideração de horário de funcionamento, intervalos, duração do serviço, reservas e bloqueios por profissional.
  - Tela de agendamento interativa com serviços, profissionais, datas e horários calculados dinamicamente.
  - Exemplos de serviços com durações de 30, 60 e 120 minutos.
- **Arquivos alterados**:
  - `src/lib/scheduling/types.ts`
  - `src/lib/scheduling/availability.ts`
  - `src/routes/schedule.tsx`
- **Testes realizados**: Revisão estática do código e validação da integração entre a tela e o motor de disponibilidade. Execução do build local não foi possível neste ambiente por indisponibilidade de resolução de rede externa.
- **Problemas encontrados**: O projeto ainda não possui persistência, autenticação ou criação real de agendamentos. O cadastro e as regras ainda são dados de demonstração.
- **Pendências relacionadas**: Modelagem persistente do domínio, autenticação, configuração de estabelecimento, serviços e profissionais via banco, criação/cancelamento de agendamentos e regras completas de disponibilidade.

## 2026-09-11 — Fundação orientada por configuração
- **Objetivo da alteração**: Evitar que a tela pública fique acoplada a dados específicos de uma barbearia e preparar o motor para receber configuração de qualquer tipo de estabelecimento.
- **Funcionalidades implementadas**:
  - Criado `src/lib/scheduling/config.ts` com uma configuração de estabelecimento de demonstração.
  - Serviços e profissionais passaram a ser consumidos da configuração centralizada.
  - Horários semanais e intervalos passaram a ser definidos por dia da semana.
  - A tela pública passou a indicar dias fechados e consumir a configuração do estabelecimento.
  - `src/lib/scheduling/types.ts` ampliado com tipos reutilizáveis para dia da semana, janelas, serviços, profissionais e exceções.
- **Arquivos alterados**:
  - `src/lib/scheduling/config.ts`
  - `src/lib/scheduling/types.ts`
  - `src/routes/schedule.tsx`
- **Testes realizados**: Revisão estática da tipagem e do fluxo entre configuração, tela e motor de disponibilidade.
- **Problemas encontrados**: A configuração ainda é estática. Persistência, autenticação e regras administrativas continuam pendentes.
- **Pendências relacionadas**: Transformar a configuração estática em dados persistidos, suportar múltiplas janelas por dia, exceções de calendário e regras específicas por profissional.
