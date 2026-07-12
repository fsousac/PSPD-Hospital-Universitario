FROM python:3.12-slim AS builder

WORKDIR /app

COPY services/data-transform-service/requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \
 && pip install --no-cache-dir -r requirements.txt

# Copia protos (context = raiz do repositório)
COPY proto /proto

# Cria diretório de stubs e gera o código
RUN mkdir -p src/generated && touch src/generated/__init__.py
RUN python -m grpc_tools.protoc \
      -I /proto \
      --python_out=src/generated \
      --grpc_python_out=src/generated \
      /proto/patient_data.proto \
      /proto/data_transform.proto

# ---- runtime ----
FROM python:3.12-slim

WORKDIR /app

COPY --from=builder /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages

# services/data-transform-service/src/generated/__init__.py fica commitado no
# git (insere o próprio diretório no sys.path — os _pb2 gerados usam import
# absoluto entre si) e tem lógica real, diferente do __init__.py vazio que o
# `touch` do builder cria só pra o protoc ter onde escrever. Por isso: copia o
# src/ real primeiro, depois só os 4 arquivos _pb2 gerados do builder — nunca
# o diretório inteiro, que traria o __init__.py vazio do builder e quebraria
# o sys.path.insert (mesmo bug já corrigido no patient-data-service, ver
# docs/decisions/0005).
COPY services/data-transform-service/src/ /app/src/
COPY --from=builder /app/src/generated/patient_data_pb2.py /app/src/generated/patient_data_pb2.py
COPY --from=builder /app/src/generated/patient_data_pb2_grpc.py /app/src/generated/patient_data_pb2_grpc.py
COPY --from=builder /app/src/generated/data_transform_pb2.py /app/src/generated/data_transform_pb2.py
COPY --from=builder /app/src/generated/data_transform_pb2_grpc.py /app/src/generated/data_transform_pb2_grpc.py

ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1

EXPOSE 50053 8083

CMD ["python", "-m", "src.main"]
