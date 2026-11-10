# Mapa do repositório

Onde o código desta fatia fica e o que o Compose sobe.

## Pastas

| Caminho | Função |
| :--- | :--- |
| `services/capture` | Registro, estado, assinatura do manifesto e a porta de crédito bloqueada |
| `services/capture-worker` | Chromium, hash, upload e sessão de vídeo. Sem banco e sem chave de assinatura |
| `services/records` | Listagem, detalhe, relatório, zip e trilha só de inclusão |
| `services/identity` | Cadastro, sessão, senha, JWKS e leitura interna de contato e CPF para o relatório |
| `services/notification` | E-mails de conta e o e-mail com o hash do manifesto |
| `gateway` | Rotas, access token e proxy da sessão de vídeo |
| `web` | Entrada, registros, novo registro, acompanhamento e detalhe |
| `packages/auth` | Validação do access token compartilhada |
| `packages/evidence` | Hash, manifesto, assinatura e estados |
| `packages/events` | Contratos dos eventos, inclusive os nomes da ADR |
| `infra` | Schemas do Postgres, proxy TLS e políticas do MinIO |
| `docs` | Este livro |

O domínio não importa Nest, Prisma nem Fastify. Cada serviço usa só o próprio schema: `identity`, `notification`, `capture` e `records`.

## O que sobe

```bash
docker compose up --build
```

| Serviço | Papel |
| :--- | :--- |
| `postgres` | PostgreSQL 16 |
| `rabbitmq` | Fila |
| `mailpit` | SMTP local, interface em <http://localhost:8025> |
| `minio` | Object storage S3, imagens públicas `bitnamilegacy/minio` e `bitnamilegacy/minio-client`. API em <http://localhost:9000> |
| `identity` | Serviço de identidade |
| `notification` | Serviço de notificação |
| `capture` | API de captura e assinatura |
| `capture-worker` | Navegador de captura, sem porta publicada |
| `records` | Registros, relatório e trilha |
| `gateway` | Entrada das APIs |
| `web` | Interface |
| `proxy` | HTTPS em <https://localhost:8443> |

Os contratos OpenAPI ficam em cada serviço. O gateway os entrega em `/v1/openapi/identity`, `/v1/openapi/notification`, `/v1/openapi/capture` e `/v1/openapi/records`.

Se o volume do Postgres já existia antes desta fatia, o serviço `schema-init` cria os schemas `capture` e `records` na subida.
