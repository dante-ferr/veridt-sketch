# Autenticação

Este capítulo descreve conta, sessão e os e-mails de cadastro e de senha. A captura está em [Evidências](evidence.md).

## O que o usuário faz

1. Cria a conta como advogado (CPF e OAB) ou usuário comum (CPF). A senha tem no mínimo 8 caracteres e precisa ser repetida. Os termos são obrigatórios.
2. Abre o link de confirmação. Sem essa confirmação o login responde que o e-mail ainda não foi confirmado.
3. Entra com e-mail e senha. Na quinta falha seguida a conta fica bloqueada por 15 minutos.
4. Sai pelo botão **Sair**. O refresh daquela sessão deixa de renovar. O access token segue válido só até os 15 minutos.
5. Pede a recuperação de senha. A resposta é a mesma se o e-mail não existir. O link vale 30 minutos e só funciona uma vez.

Os números estão em [Decisões fechadas](decisions.md). O código que os guarda é `services/identity/src/domain/policy.ts`.

## Como a sessão é conferida

A identidade assina o access token com Ed25519 e publica a chave em `GET /v1/keys/jwks`. O gateway e os serviços conferem a assinatura com essa chave. Eles não chamam a identidade a cada pedido. O gateway guarda a chave em cache por 10 minutos. Um token com prazo maior que 15 minutos é recusado.

Rotas sem access token: cadastro, confirmação de e-mail, login, renovação, recuperação de senha, redefinição, JWKS, saúde e os contratos OpenAPI. O resto passa pelo gateway só com token válido. A identidade confere de novo nas rotas `GET /v1/me` e `POST /v1/sessions/logout`. A notificação confere em `GET /v1/session`, que o gateway não publica.

O navegador guarda o refresh e o access token na sessão da aba. Ele renova o access token quando o prazo acaba, ou uma vez quando uma rota autenticada responde 401, e então repete o pedido. Várias renovações ao mesmo tempo viram um único `POST /v1/sessions/refresh`. A volta ao login ocorre quando esse refresh responde 401, ou quando o pedido repetido continua em 401. Um 403 permanece na tela. Um 429 na renovação não apaga o refresh: o limite do gateway é 20 pedidos por minuto, e abrir outra página não gasta esse limite enquanto o access token vale.

## Dados e fila

A conta base fica separada do perfil. O CPF é cifrado na aplicação (AES-256-GCM). A unicidade usa HMAC e não o número em claro. A OAB do advogado também é cifrada. O e-mail fica consultável porque é a chave de login. Log de aplicação não grava CPF, e-mail nem token.

A identidade grava o evento e o publica na exchange `veridit.events`. A notificação consome, manda o e-mail pelo SMTP do Mailpit e ignora uma segunda entrega do mesmo id. Os tipos dos eventos continuam `ConfirmacaoEmailSolicitada` e `RecuperacaoSenhaSolicitada`. Os outros campos da mensagem estão em inglês: `type`, `version`, `id`, `occurredAt` e `data`.

## O que impede regressão

| Afirmação | Teste |
| :--- | :--- |
| CPF com dígitos verificadores | `services/identity/src/domain/cpf.test.ts` |
| Bloqueio na 5ª falha | `services/identity/src/domain/login.test.ts` |
| Access token de 15 minutos | `services/identity/src/domain/access-token.test.ts` e `packages/auth/src/verify-access-token.test.ts` |
| Refresh revogado não renova | `services/identity/src/domain/refresh.test.ts` |
| 401 autenticado renova uma vez e repete; 403 e 429 não encerram a sessão | `web/src/api.test.ts` |
| Rotas públicas explícitas | `gateway/src/routes.test.ts` |

Rode com `npm test`.

## O que esta fatia não faz

Não há compra de crédito nem segunda instância. A captura e a prova estão em [Evidências](evidence.md). A notificação também envia o e-mail de `CapturaConcluida`, com o hash do manifesto.
