# Mapa do repositório

Onde o código desta fatia fica e o que o Compose sobe.

## Pastas

| Caminho | Função |
| :--- | :--- |
| `services/payments` | Pacotes, pedidos, livro-razão, webhook, reconciliação e reserva |
| `services/capture` | Registro, estado, assinatura do manifesto e a chamada de reserva |
| `services/capture-worker` | Chromium, hash, upload e sessão de vídeo. Sem banco e sem chave de assinatura |
| `services/records` | Listagem, detalhe, relatório, zip e trilha só de inclusão |
| `services/identity` | Cadastro, sessão, senha, JWKS e leitura interna de contato e CPF para o relatório |
| `services/notification` | E-mails de conta, de pagamento aprovado e o e-mail com o hash do manifesto |
| `gateway` | Rotas, access token e proxy da sessão de vídeo |
| `web` | Entrada, registros, novo registro, créditos, acompanhamento e detalhe |
| `packages/auth` | Validação do access token compartilhada |
| `packages/evidence` | Hash, manifesto, assinatura e estados |
| `packages/events` | Contratos dos eventos, inclusive os nomes da ADR |
| `infra` | Schemas do Postgres, proxy TLS e políticas do MinIO |
| `docs` | Este livro |

O domínio não importa Nest, Prisma nem Fastify. Cada serviço usa só o próprio schema: `identity`, `notification`, `capture`, `records` e `payments`.

## Organização do `web/src`

| Pasta | O que guarda |
| :--- | :--- |
| `app` | Rotas (`App.tsx`) |
| `pages/<área>` | Uma tela por arquivo: `auth`, `records`, `account`, `credits`. O CSS próprio da área fica ao lado (`auth.css`, `records.css`, `credits.css`) |
| `components` | Peças reutilizáveis. `layout/AppShell` é a moldura da área logada; `ui` tem as peças do Figma (`Card`, `Heading`, `PageHeader`, `Field`, `Input`, `Select`, `Button`, `ButtonLink`, `TextLink`, `ActionRow`, `Text`, `Hint`, `StateBadge`); `<área>` tem as de uma área só |
| `hooks` | `useSession`, `useCreditBalance` e outros hooks |
| `services` | Cliente HTTP (`api.ts`) e guarda dos tokens (`session-store.ts`) |
| `utils` | Funções puras: formatação de data e de valor, máscara de CPF, rótulos de estado |
| `types` | Tipos das respostas da API |
| `styles` | CSS global: tokens de cor e fonte (`--color-*`, `--font-mono`), base, tabela (`.data-table`) e cartões de opção |
| `dev` | Dados de exemplo, carregados só no modo Vite |

Imports entre pastas usam o alias `@/` (`@/hooks/useSession`), configurado em `web/tsconfig.json` e `web/vite.config.ts`. As classes CSS são globais; o arquivo de cada área só agrupa as regras dela.

Tela nova ou migrada para o Figma monta a interface com os componentes de `components/ui` e usa os tokens `--color-*`. Cada componente tem a própria pasta (`Button/Button.tsx` + `Button.css`); as páginas importam de `@/components/ui`, que só reexporta. O CSS da página fica só com o layout dela (grades, larguras, espaços entre blocos). Valor visual repetido em mais de uma tela vira componente ou regra em `styles/`, não cópia.

## Interface local

Dois modos. Os comandos estão no README.

| Modo | Como abrir | **Preencher exemplo** |
| :--- | :--- | :--- |
| Compose | `make up`, site em <https://localhost:8443> | Não. A imagem entrega o build de produção (`import.meta.env.DEV` falso). |
| Vite | `make web-dev` com a stack no ar, <http://localhost:5173> | Sim, em cadastro e faturamento. O Vite encaminha `/v1` para <https://localhost:8443>. |

## O que sobe

```bash
make up
```

| Serviço | Papel |
| :--- | :--- |
| `postgres` | PostgreSQL 16 |
| `rabbitmq` | Fila |
| `mailpit` | SMTP local, interface em <http://localhost:8025> |
| `minio` | Object storage S3, imagens públicas `bitnamilegacy/minio` e `bitnamilegacy/minio-client`. API em <http://localhost:9000> |
| `identity` | Serviço de identidade |
| `notification` | Serviço de notificação |
| `payments` | Créditos, pedidos e o adaptador de pagamento |
| `capture` | API de captura e assinatura |
| `capture-worker` | Navegador de captura, sem porta publicada |
| `records` | Registros, relatório e trilha |
| `gateway` | Entrada das APIs |
| `web` | Interface |
| `proxy` | HTTPS em <https://localhost:8443> |

Os contratos OpenAPI ficam em cada serviço. O gateway os entrega em `/v1/openapi/identity`, `/v1/openapi/notification`, `/v1/openapi/capture`, `/v1/openapi/records` e `/v1/openapi/payments`.

Se o volume do Postgres já existia antes desta fatia, o serviço `schema-init` cria os schemas que faltam, inclusive `payments`, na subida.
