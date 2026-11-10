# Créditos e pagamentos

Este capítulo descreve a fatia da ADR-003: livro-razão, compra com preço congelado, reserva síncrona e confirmação do pagamento só depois de consultar o provedor.

## O que o usuário faz

Não há conta seed. O cadastro cria a conta. O saldo começa em zero.

1. Abre **Créditos**, escolhe um pacote e informa o faturamento. Telefone, CPF e endereço ficam só no schema `payments`.
2. O pedido copia nome, quantidade de créditos e valor por crédito do pacote. Uma mudança posterior no pacote não altera esse pedido.
3. A cobrança nasce `PENDENTE`. Pix ou checkout não credita o saldo. O navegador também não credita ao voltar do checkout.
4. O webhook exige o segredo `PAYMENT_WEBHOOK_SECRET` no cabeçalho `x-webhook-signature`. O serviço consulta o provedor e só então muda o estado. A mesma cobrança, repetida, não lança crédito de novo.
5. Com `APROVADO`, o livro-razão recebe um lançamento de compra e a outbox grava `PagamentoAprovado`. A notificação manda o e-mail.
6. Ao iniciar um registro, a API de Captura reserva 1 crédito antes de enfileirar a tela e, no vídeo, depois de alocar o navegador. Sem saldo, ou com saldo negativo, a captura não grava registro. Se o serviço de pagamentos não responde em 3 segundos, a mensagem é `credits_unavailable`.
7. `CapturaConcluida` converte a reserva em consumo. `CapturaFalhou` e `CapturaCancelada` devolvem a reserva e publicam `CreditoDevolvido`. Repetir o evento não lança de novo. Consumo depois de devolução não debita outra vez.
8. `PagamentoEstornado` só sai de `APROVADO` para `ESTORNADO` e debita os créditos daquela compra, mesmo se já tiverem sido usados. O saldo pode ficar negativo. Os registros já feitos continuam na listagem.

A tarefa de reconciliação consulta cobranças `PENDENTE` com mais de 15 segundos. Neste ambiente ela roda a cada 60 segundos, dentro da meta de 30 minutos da ADR. O Pix expira em 30 minutos. Uma vez por dia o serviço compara o saldo em cache com a soma do livro-razão e registra `ledger_cache_mismatch` se divergirem.

## Provedor

O Compose sobe com `PAYMENT_PROVIDER=fake`. O adaptador falso grava a cobrança em `provider_charges` e não chama o Mercado Pago. O Pix simulado do sandbox não entra nesta fatia: não há conta de teste configurada. Na tela de pagamento, **Confirmar pagamento de teste** marca a cobrança como paga no adaptador falso e percorre o mesmo webhook assinado e a mesma consulta. Sem esse passo o saldo continua zero.

`PAYMENT_PROVIDER=mercadopago` usa a API HTTP do Mercado Pago quando `MERCADOPAGO_ACCESS_TOKEN` está preenchido. Sem o token, a compra responde `payments_unavailable`. O código de negócio não importa o SDK do provedor.

## Pacotes iniciais

A área administrativa que cria pacotes fica para a ADR-009. Enquanto isso, a subida grava três pacotes se o código ainda não existe:

| Pacote | Créditos | Valor por crédito | Total |
| :--- | :--- | :--- | :--- |
| Básico | 10 | R$ 5,00 | R$ 50,00 |
| Médio | 30 | R$ 4,00 | R$ 120,00 |
| Premium | 100 | R$ 3,00 | R$ 300,00 |

Cada registro, tela ou vídeo, reserva 1 crédito. A ADR não fixou esse número; a tela de compra diz 1.

## O que impede regressão

| Afirmação | Teste |
| :--- | :--- |
| Mil webhooks da mesma cobrança geram um só crédito | `services/payments/src/domain/books.test.ts` |
| Cobrança ainda pendente no provedor não credita | o mesmo arquivo |
| Webhook perdido é recuperado na reconciliação, uma vez | o mesmo arquivo |
| Pix vencido expira sem crédito | o mesmo arquivo |
| Preço do pedido não segue uma mudança posterior do pacote | o mesmo arquivo |
| Falha devolve o crédito uma vez; consumo tardio não debita de novo | o mesmo arquivo |
| Estorno deixa saldo negativo e bloqueia a reserva seguinte | o mesmo arquivo |
| Assinatura do webhook | `services/payments/src/domain/signature.test.ts` |
| Livro-razão rejeita update e delete | `services/payments/src/domain/ledger-migration.test.ts` |
| E-mail de `PagamentoAprovado` | `services/notification/src/domain/message.test.ts` |
| Webhook público e compra autenticada | `gateway/src/routes.test.ts` |

Rode com `npm test`.

## O que esta fatia não faz

A reserva presa por queda do worker não expira aqui. Isso é a ADR-005. A ADR-004, o pool de navegadores e a elasticidade da fila não começaram. Não há tela de administrador para criar pacote. O expurgo continua na ADR-007.
