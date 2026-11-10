# Veridit

Implementação do Veridit a partir da arquitetura em <https://github.com/RottyWheels/ESA_Trabalho>. O ponteiro local é `docs/references/architecture-repo.txt`. O enunciado, as ADRs e as telas ficam naquele repositório.

O método está no livro em `docs/`.

```bash
make docs-serve
```

O livro abre em <http://localhost:3000>.

A fatia atual sobe identidade, notificação, captura, worker, registros, gateway e o site:

```bash
npm install
npm test
docker compose up --build
```

O site fica em <https://localhost:8443>. O certificado é autoassinado; aceite o aviso do navegador para `localhost`. O Mailpit fica em <http://localhost:8025>. O storage S3 fica em <http://localhost:9000>. A reserva de crédito responde bloqueada até a ADR-003.
