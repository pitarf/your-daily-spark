# Assistente de agenda com IA

O Marca Minha Vez possui uma primeira camada de assistente de agenda. O objetivo é permitir que o administrador descreva o expediente em linguagem natural e receba uma configuração estruturada antes de aplicar qualquer mudança.

## Configuração do expediente

### Exemplo

> Estou disponível de segunda a sexta das 9 às 18, com intervalo das 12 às 13. No sábado das 9 às 14. Domingo fechado.

O assistente transforma a descrição em sete dias, janelas de atendimento e intervalos.

### Fluxo

1. O administrador abre `/dashboard/assistant`.
2. O sistema carrega somente o expediente geral atual do estabelecimento.
3. A descrição é enviada para o provedor de IA exclusivamente no servidor.
4. A resposta é solicitada em JSON e validada com Zod antes de aparecer na tela.
5. O administrador revisa a prévia e confirma explicitamente a alteração.
6. A aplicação substitui somente o expediente geral (`professional_id IS NULL`).
7. Agendas individuais dos profissionais não são alteradas.

## Consulta operacional

O mesmo assistente possui uma consulta somente leitura para perguntas administrativas, por exemplo:

> Quantos agendamentos tenho amanhã?

> Quais serviços estão cadastrados?

> Quais profissionais estão ativos?

> Tenho bloqueios nos próximos dias?

A consulta reúne no servidor os dados necessários do estabelecimento, profissionais, serviços, agendamentos e bloqueios dos próximos 30 dias. O contexto enviado ao Gemini não inclui telefone, e-mail ou outros dados pessoais de clientes.

A consulta exige sessão válida e membership `admin`. Ela não altera agenda, serviços, profissionais, clientes ou bloqueios.

## Segurança

Os endpoints do assistente exigem token de sessão e membership com papel `admin`. A chamada ao provedor usa `GEMINI_API_KEY` apenas no servidor.

A IA não executa automaticamente uma mudança. A configuração do expediente sempre possui etapa de revisão e confirmação humana antes da gravação. A consulta operacional é somente leitura.

As respostas operacionais também são solicitadas em JSON estruturado e validadas com Zod antes de serem exibidas.

## Configuração do provedor

Variável obrigatória:

```text
GEMINI_API_KEY=...
```

Opcionalmente, o modelo pode ser alterado com:

```text
GEMINI_SCHEDULE_MODEL=gemini-2.5-flash-lite
```

O assistente usa a API Gemini `generateContent`, com saída JSON estruturada e validação adicional no servidor. O formato estruturado reduz respostas fora do contrato; a validação Zod continua sendo a barreira final antes de qualquer alteração no banco.

## Limitações atuais

- A consulta operacional trabalha com uma janela de dados de 30 dias.
- A IA não deve ser usada como fonte de verdade quando os dados retornados forem insuficientes.
- A disponibilidade exata de um novo horário ainda deve ser calculada pelo motor de disponibilidade, não inferida pelo modelo.
- Ações administrativas além da alteração explícita do expediente ainda não são executadas pela IA.
