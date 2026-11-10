# Veridt

Implementação do Veridt a partir da arquitetura em <https://github.com/RottyWheels/ESA_Trabalho>. O ponteiro local é `docs/references/architecture-repo.txt`. O enunciado, as ADRs e as telas ficam naquele repositório.

O método está no livro em `docs/`.

## Pré-requisitos

- Node.js 22 e npm, para testes e para o Vite
- Docker com Compose, para a stack
- mdBook, só para `make docs-serve`

Na primeira vez, na raiz do repositório:

```bash
npm install
```

## Comandos

`make help` lista os alvos.

| Comando | O que faz |
| :--- | :--- |
| `make up` | Sobe a stack (`docker compose up --build`) |
| `make down` | Para a stack |
| `make logs` | Acompanha os logs do Compose |
| `make web-dev` | Sobe o Vite em <http://localhost:5173> |
| `make test` | Roda os testes |
| `make verify` | Roda `scripts/verify-flows.mjs` |
| `make docs-serve` | Abre o livro em <http://localhost:3000> |

## Subir a stack

```bash
make up
```

O comando fica em primeiro plano. Em outro terminal, `make down` para os containers. `make logs` segue a saída quando a stack já está no ar.

| Serviço | Endereço |
| :--- | :--- |
| Site (build de produção) | <https://localhost:8443> |
| Mailpit | <http://localhost:8025> |
| API S3 (MinIO) | <http://localhost:9000> |

O certificado de `localhost:8443` é autoassinado. Aceite o aviso do navegador.

O proxy publica só a porta 8443. O gateway não tem porta no host. O Vite, no modo DEV, encaminha `/v1` para esse mesmo proxy.

## Site pelo Compose

Use este modo para ver a interface que a imagem Docker entrega.

`make up` constrói `web` com `vite build`. Nesse build, `import.meta.env.DEV` é falso. O botão **Preencher exemplo** não entra no bundle e não aparece em cadastro nem em faturamento. Não há HMR. Para ver uma alteração de frontend, suba de novo com `make up` (o Compose reconstrói a imagem).

## Site pelo Vite

Use este modo para desenvolver a interface, com HMR e com o botão **Preencher exemplo**.

A API não sobe com o Vite. Deixe `make up` rodando e, em outro terminal:

```bash
make web-dev
```

O site abre em <http://localhost:5173>. Se essa porta já estiver ocupada, o Vite escolhe a seguinte e imprime o endereço. O Vite encaminha `/v1`, inclusive o WebSocket da sessão de vídeo, para <https://localhost:8443>. O proxy do Vite aceita o certificado autoassinado (`secure: false` em `web/vite.config.ts`). O browser fala só com o Vite, em HTTP.

O botão **Preencher exemplo** aparece em cadastro e em faturamento só neste modo.

Os e-mails do Mailpit usam a origem `https://localhost:8443`. O link abre o site do Compose. Para a mesma rota no Vite, troque a origem por `http://localhost:5173`.

## Testes

Os testes não dependem da stack:

```bash
make test
```

## Livro

```bash
make docs-serve
```

O livro abre em <http://localhost:3000>.
