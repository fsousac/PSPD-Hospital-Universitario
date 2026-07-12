FROM python:3.12-slim AS builder

WORKDIR /app

COPY services/patient-data-service/requirements.txt .
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
      /proto/patient_data.proto

# ---- runtime ----
FROM python:3.12-slim

WORKDIR /app

COPY --from=builder /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages

# services/patient-data-service/src/generated/__init__.py fica commitado no
# git (insere o próprio diretório no sys.path — os _pb2 gerados usam import
# absoluto entre si, não relativo) e tem lógica real, diferente do
# __init__.py vazio que o `touch` do builder cria só pra o protoc ter onde
# escrever. Por isso: copia o src/ real primeiro, depois só os DOIS arquivos
# _pb2 gerados do builder — nunca o diretório inteiro, que traria o
# __init__.py vazio do builder e quebraria o sys.path.insert.
COPY services/patient-data-service/src/ /app/src/
COPY --from=builder /app/src/generated/patient_data_pb2.py /app/src/generated/patient_data_pb2.py
COPY --from=builder /app/src/generated/patient_data_pb2_grpc.py /app/src/generated/patient_data_pb2_grpc.py

ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1

EXPOSE 50052 8082

CMD ["python", "-m", "src.main"]
