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

O código, as pastas, as rotas e os schemas usam inglês. Os nomes de evento ficam como estão nas ADRs: `ConfirmacaoEmailSolicitada`, `RecuperacaoSenhaSolicitada`, `RegistroCriado`, `CapturaExecutada`, `CapturaComErro`, `CapturaConcluida`, `CapturaFalhou`, `CapturaCancelada` e `EventoAuditoria`.

## 5. Fatia atual: ADR-001 e ADR-002

A ADR-001 continua valendo: cadastro, confirmação, login, logout, recuperação e o bloqueio após 5 falhas. A ADR-002 acrescenta captura no servidor, manifesto assinado, storage imutável e trilha só de inclusão. O comportamento está em [Evidências](evidence.md).

A reserva de crédito é uma porta da API de Captura. Nesta fatia o adaptador responde bloqueado. Não há saldo, pacote nem compra. A captura de tela não entra na fila. No vídeo, o worker aloca o navegador, a reserva bloqueia e o navegador é descartado. Nenhum registro é gravado.

Números da ADR-002 que a ADR não fixa:

| Regra | Valor |
| :--- | :--- |
| Alerta de relógio contra o NTP | 1 segundo |
| Carga da página | 30 segundos |
| Sessão de vídeo | 15 minutos |
| Link de download | 5 minutos |
| Página da listagem | 5 registros |

Números que a ADR não fixa e que valem neste código:

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

## O que ainda está aberto

| Item aberto | Quando se resolve |
| :--- | :--- |
| Segunda instância do gateway e da identidade | ADR-005 |
| Certificado de uma autoridade pública, cofre de segredos e cifra do volume do Postgres | Quando a implantação deixar de ser só local |
| Reserva de crédito, compra, livro-razão, webhook e estorno | ADR-003. A porta já existe e está bloqueada |
| Expurgo e prazo de retenção | ADR-007 |
| Expiração de captura abandonada em `EM_ANDAMENTO` | ADR-005 |
| Carimbo ICP-Brasil | Evolução citada na ADR-002, fora desta fatia |
| ADR-003 e o restante do produto | Só depois de confirmação explícita. Veja o [roteiro](roadmap.md) |
