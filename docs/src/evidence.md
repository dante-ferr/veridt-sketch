# Evidências

Este capítulo descreve a fatia da ADR-002 que está no código: captura no servidor, manifesto assinado, storage imutável e trilha só de inclusão. Compra, saldo e devolução de crédito não estão aqui.

## O que o usuário faz

1. Entra e abre **Novo registro**. Escolhe captura de tela ou vídeo de navegação, informa um endereço público e um título.
2. Ao iniciar, a API de Captura chama a porta de reserva de crédito. O adaptador desta fatia responde `credit_reservation_blocked`. Nenhum registro é gravado e nada entra na fila.
3. No vídeo, a ordem é alocar o navegador no worker e só então pedir a reserva. Como a reserva bloqueia, o worker descarta o navegador e o registro também não é gravado.
4. Quando uma reserva futura devolver `reserved`, a tela fica `NA_FILA` e o vídeo fica `EM_ANDAMENTO`. Só a API de Captura muda o estado.
5. O worker pede o início da tela pelo broker. A API só passa de `NA_FILA` para `EM_ANDAMENTO` se o estado ainda for `NA_FILA`.
6. O worker calcula o SHA-256, grava os arquivos e o manifesto no MinIO e publica `CapturaExecutada`. Ele não assina.
7. A API confere o hash do manifesto e o checksum de cada arquivo no storage. Se bater, assina, marca `CONCLUIDO` e publica `CapturaConcluida`. Se não bater, marca `FALHOU` e não assina.
8. Falha de carga publica `CapturaComErro`. A captura não é refeita. O usuário pode cancelar `NA_FILA` ou `EM_ANDAMENTO`, e o estado vai para `CANCELADO`.
9. A notificação manda o hash do manifesto no e-mail de `CapturaConcluida`.
10. Registros e Relatórios lista, mostra o detalhe e, só para `CONCLUIDO`, gera relatório e zip com manifesto, assinatura e hashes. O link de download vale 5 minutos e entra na trilha.

A chave pública fica em `GET /v1/capture/signing-key`. A chave privada fica no volume `capture-secrets`, montado só na API de Captura.

## Estados

`NA_FILA`, `EM_ANDAMENTO`, `CONCLUIDO`, `FALHOU` e `CANCELADO`. `NA_FILA` existe só na captura de tela.

## O que impede regressão

| Afirmação | Teste |
| :--- | :--- |
| Hash e assinatura; um byte alterado é detectado | `packages/evidence/src/manifest.test.ts` |
| Tela começa em `NA_FILA`; vídeo começa em `EM_ANDAMENTO`; segundo início é recusado | o mesmo arquivo |
| Reserva bloqueada não grava registro; vídeo aloca e descarta | `services/capture/src/application/start-capture.test.ts` |
| Assinatura só com checksum igual; falha não repete | `services/capture/src/application/accept-executed.test.ts` |
| Worker faz hash antes do upload e não assina | `services/capture-worker/src/application/run-screenshot.test.ts` |
| Worker não cita a chave de assinatura | `services/capture-worker/src/domain/worker-boundary.test.ts` |
| Alerta de relógio a partir de 1 segundo | `packages/evidence/src/manifest.test.ts` e `services/capture-worker/src/domain/ntp.test.ts` |
| E-mail de conclusão traz o hash | `services/notification/src/domain/message.test.ts` |
| Relatório só de registro `CONCLUIDO` | `services/records/src/domain/report.test.ts` e `services/records/src/application/package-evidence.test.ts` |
| Trilha recusa update e delete | `services/records/src/domain/audit-migration.test.ts` |
| Rotas novas exigem access token; a chave pública não | `gateway/src/routes.test.ts` |

Rode com `npm test`.

## Números que a ADR não fixou

| Regra | Valor |
| :--- | :--- |
| Alerta de relógio | 1 segundo, ou NTP inacessível |
| Tempo de carga da página | 30 segundos; depois disso a captura falha |
| Sessão de vídeo | 15 minutos |
| Link de download | 5 minutos |
| Página da listagem | 5 registros |

O relógio gravado é o do servidor, em UTC. O worker consulta `pool.ntp.org`. Se a diferença passar de 1 segundo, ou se o NTP não responder, ele registra `clock_alert` e segue. O carimbo ICP-Brasil não entra.

## O que esta fatia não faz

Não há saldo, pacote, Mercado Pago, livro-razão, webhook nem estorno. A porta `CreditReservationPort` é o único lugar da reserva. O adaptador em produção é `BlockedCreditReservation`.

A exclusão de evidência responde `purge_pending_adr_007` e não apaga arquivo. O prazo de retenção fica para a ADR-007. Uma captura que o worker abandona em `EM_ANDAMENTO` não expira nesta fatia; isso fica para a ADR-005. O usuário pode cancelar.

O storage local usa `docker.io/bitnamilegacy/minio` e `docker.io/bitnamilegacy/minio-client` (MinIO `DEVELOPMENT.2025-05-24`). `quay.io/minio/minio` e `quay.io/minio/mc` recusam pull anônimo, e as tags antigas do Docker Hub não existem. O bucket `evidence` nasce com object lock e versionamento. As credenciais da aplicação não apagam objeto. Um segundo `Put` do mesmo nome usa `If-None-Match: *`. Relatório e zip vão para o bucket `artifacts`.
