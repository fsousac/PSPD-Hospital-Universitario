# ADR 0002 — Patient Data Service: decisões técnicas

**Autor:** Yasmim

---

## Contexto

O enunciado especificava Patient Data Service com PostgreSQL, mas não definia linguagem, ORM, driver de banco nem protocolo de comunicação interna. O restante da equipe já usava gRPC para o Authorization Service, e a linguagem ficou em aberto.

## Decisões

### 1. Linguagem: Python 3

Python tem ecossistema maduro para gRPC (`grpcio`), ORM async (`SQLAlchemy 2`) e processamento de dados clínicos. A simplicidade da linguagem reduz o tempo de desenvolvimento para um projeto acadêmico com prazo curto.

### 2. Comunicação: gRPC

Mantém consistência com o Authorization Service. O Data Transform Service consome o PDS via gRPC, permitindo contrato fortemente tipado definido em `proto/patient_data.proto`.

### 3. ORM: SQLAlchemy 2 async + asyncpg

SQLAlchemy 2 oferece API assíncrona nativa (`AsyncSession`) compatível com o event loop do servidor gRPC. O driver `asyncpg` é o mais performático para PostgreSQL em Python async. A combinação evita o bloqueio do event loop em queries ao banco.

### 4. Servidor gRPC: shutdown via `try/except KeyboardInterrupt`

`asyncio.loop.add_signal_handler` não é implementado no Windows. Para garantir compatibilidade cross-platform (Windows PowerShell + Linux/Docker), o graceful shutdown é feito capturando `KeyboardInterrupt` em torno de `server.wait_for_termination()`.

### 5. Stubs gerados em `src/generated/` com `__init__.py` customizado

O `grpc_tools.protoc` gera arquivos `*_pb2.py` e `*_pb2_grpc.py` que se importam entre si pelo nome simples (sem prefixo de pacote). Para resolver o `ModuleNotFoundError` ao colocar os stubs em subpasta, o `src/generated/__init__.py` insere o diretório no `sys.path` em tempo de importação.

### 6. Testes: pytest-asyncio + Testcontainers

Testes de integração usam `testcontainers[postgres]` para subir um PostgreSQL real em Docker durante a execução, garantindo fidelidade ao ambiente de produção sem dependência de banco externo. Testes unitários usam SQLite in-memory via `aiosqlite`.

## Consequências

- Scripts `generate_protos.ps1` e `generate_protos.sh` devem ser rodados após qualquer alteração nos `.proto` antes de subir o serviço.
- O driver asyncpg não suporta conexões síncronas — toda interação com o banco deve ser feita dentro de coroutines.
- Testcontainers exige Docker disponível na máquina para os testes de integração.
