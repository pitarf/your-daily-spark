# Assistente de agenda com IA

O Marca Minha Vez possui uma primeira camada de assistente de agenda. O objetivo é permitir que o administrador descreva o expediente em linguagem natural e receba uma configuração estruturada antes de aplicar qualquer mudança.

## Exemplo

> Estou disponível de segunda a sexta das 9 às 18, com intervalo das 12 às 13. No sábado das 9 às 14. Domingo fechado.

O assistente transforma a descrição em sete dias, janelas de atendimento e intervalos.

## Fluxo

1. O administrador abre `/dashboard/assistant`.
2. O sistema carrega somente o expediente geral atual do estabelecimento.
3. A descrição é enviada para o provedor de IA exclusivamente no servidor.
4. A resposta é solicitada em JSON e validada com Zod antes de aparecer na tela.
5. O administrador revisa a prévia e confirma explicitamente a alteração.
6. A aplicação substitui somente o expediente geral (`professional_id IS NULL`).
7. Agendas individuais dos profissionais não são alteradas.

## Segurança

O endpoint de aplicação exige token de sessão e membership com papel `admin`. A chamada ao provedor usa `GEMINI_API_KEY` apenas no servidor.

A IA não executa automaticamente uma mudança. Sempre existe uma etapa de revisão e confirmação humana antes da gravação.

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

## Limitação atual

Nesta primeira versão o assistente trata especificamente de configuração do expediente geral. Ainda não interpreta automaticamente serviços, preços, profissionais, bloqueios ou comandos de consulta como “qual o próximo horário livre?”. Essas capacidades entram na evolução seguinte do assistente.
