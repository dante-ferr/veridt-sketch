# Decisões fechadas

Registro do que vale a partir de 7 de novembro de 2026. Onde uma frase podia ser lida de dois jeitos, a leitura que vale daqui para a frente está escrita por extenso.

## 1. As ADRs aceitas do repositório de arquitetura valem aqui

O código segue as ADRs com status aceito em <https://github.com/RottyWheels/ESA_Trabalho>. Não reabra uma ADR aceita neste repositório. A proposta em `docs/tecnologias.md` daquele repositório não é ADR: a stack abaixo foi escolhida à parte e fica registrada aqui.

## 2. A interface segue as telas do repositório de arquitetura

A aparência acompanha as telas de login, cadastro e recuperação de senha daquele repositório. Elas não são copiadas para cá.

## 3. O livro é local

A pré-visualização é `make docs-serve`. Não há publicação do livro. O texto do livro fica em português. Os nomes de arquivo do livro ficam em inglês.

## 4. Stack desta fatia

Todo o sistema desta fatia é TypeScript em Node.js.

| Peça | Escolha |
| :--- | :--- |
| Interface | React e Vite |
| API Gateway | Fastify |
| Serviços | NestJS |
| Banco | PostgreSQL 16 e Prisma, um schema e um usuário por serviço |
| Senha | Argon2id, memória 19.456 KiB, tempo 2, paralelismo 1 |
| Sessão | JWT Ed25519, chave pública em JWKS |
| Fila | RabbitMQ |
| E-mail local | Mailpit |

O código, as pastas, as rotas e os schemas usam inglês. Os nomes de evento ficam como estão nas ADRs: `ConfirmacaoEmailSolicitada`, `RecuperacaoSenhaSolicitada`, `RegistroCriado`, `CapturaExecutada`, `CapturaComErro`, `CapturaConcluida`, `CapturaFalhou`, `CapturaCancelada`, `EventoAuditoria`, `PagamentoAprovado` e `CreditoDevolvido`. `PagamentoEstornado` é tratado dentro do serviço de pagamentos e não vai para a notificação.

## 5. Fatia atual: ADR-001, ADR-002 e ADR-003

A ADR-001 continua valendo: cadastro, confirmação, login, logout, recuperação e o bloqueio após 5 falhas. A ADR-002 acrescenta captura no servidor, manifesto assinado, storage imutável e trilha só de inclusão. A ADR-003 acrescenta o livro-razão, a compra e a reserva real. O comportamento está em [Evidências](evidence.md) e [Créditos e pagamentos](payments.md).

A reserva é chamada síncrona ao serviço de pagamentos. O adaptador bloqueado permanece só nos testes da porta. Em execução, saldo insuficiente ou serviço fora do ar impede a captura e não grava registro.

Números que as ADRs não fixam:

| Regra | Valor |
| :--- | :--- |
| Alerta de relógio contra o NTP | 1 segundo |
| Carga da página | 30 segundos |
| Sessão de vídeo | 15 minutos |
| Link de download | 5 minutos |
| Página da listagem | 5 registros |
| Créditos por registro | 1, na tela e no vídeo |
| Pacotes iniciais | Básico 10 × R$ 5,00; Médio 30 × R$ 4,00; Premium 100 × R$ 3,00 |
| Vida do Pix | 30 minutos |
| Reconciliação | A cada 60 segundos, só cobranças `PENDENTE` com mais de 15 segundos |
| Conferência do saldo | A cada 24 horas |
| Espera da reserva | 3 segundos; depois a captura não começa |
| Provedor local | Adaptador falso. Mercado Pago só com token e `PAYMENT_PROVIDER=mercadopago` |

Números de sessão que a ADR-001 não fixa:

| Regra | Valor |
| :--- | :--- |
| Access token | 15 minutos |
| Refresh token | 7 dias, revogado no logout |
| Bloqueio de login | 15 minutos após a 5ª falha seguida. O contador zera quando o prazo acaba |
| Link de recuperação | 30 minutos, uso único |
| Link de confirmação de e-mail | 24 horas, uso único |
| Pedidos de recuperação | No máximo 5 a cada 15 minutos por conta; a resposta HTTP não muda |
| Limite no gateway | 20 pedidos por minuto por IP em login, renovação e senha |

A entrada externa é HTTPS em `https://localhost:8443`, com certificado autoassinado gerado na primeira subida. A rede entre os containers do Compose fica em HTTP.

## 6. O produto se chama Veridt

O nome visível é Veridt: interface, e-mails, título do livro e escopo npm `@veridt`.

Estes identificadores internos continuam com a grafia antiga, para não derrubar sessão, volume ou fila já criados:

| Identificador | Valor que permanece |
| :--- | :--- |
| Emissor e audiência do JWT | `veridit-identity` e `veridit` |
| Exchange | `veridit.events` |
| Projeto do Compose, banco, usuário do Postgres, RabbitMQ e MinIO | `veridit` |
| Chaves no navegador | `veridit.access`, `veridit.refresh`, `veridit.packageId`, evento `veridit-balance` |

Os nomes de evento das ADRs não mudam. O ponteiro em `docs/references/architecture-repo.txt` continua apontando para o repositório externo.

## O que ainda está aberto

| Item aberto | Quando se resolve |
| :--- | :--- |
| Segunda instância do gateway e da identidade | ADR-005 |
| Certificado de uma autoridade pública, cofre de segredos e cifra do volume do Postgres | Quando a implantação deixar de ser só local |
| Expurgo e prazo de retenção | ADR-007 |
| Expiração de captura abandonada e de reserva presa | ADR-005 |
| Pool de navegadores e elasticidade da fila | ADR-004 |
| Tela de administrador para criar pacote | ADR-009 |
| Carimbo ICP-Brasil | Evolução citada na ADR-002, fora desta fatia |
| ADR-004 e o restante do produto | Só depois de confirmação explícita. Veja o [roteiro](roadmap.md) |
