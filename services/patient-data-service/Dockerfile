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
COPY --from=builder /app/src/generated /app/src/generated

COPY services/patient-data-service/src/ /app/src/

ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1

EXPOSE 50052 8082

CMD ["python", "-m", "src.main"]
