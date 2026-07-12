FROM node:22-alpine AS builder

WORKDIR /app

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./

ARG VITE_API_BASE_URL=http://localhost:8088/api
ARG VITE_AUTH_MODE=mock
ARG VITE_ENABLE_MOCKS=true
ARG VITE_KEYCLOAK_URL=http://localhost:8180
ARG VITE_KEYCLOAK_REALM=hu
ARG VITE_KEYCLOAK_CLIENT_ID=hu-frontend
ARG VITE_BASE_PATH=/

ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_AUTH_MODE=$VITE_AUTH_MODE
ENV VITE_ENABLE_MOCKS=$VITE_ENABLE_MOCKS
ENV VITE_KEYCLOAK_URL=$VITE_KEYCLOAK_URL
ENV VITE_KEYCLOAK_REALM=$VITE_KEYCLOAK_REALM
ENV VITE_KEYCLOAK_CLIENT_ID=$VITE_KEYCLOAK_CLIENT_ID
ENV VITE_BASE_PATH=$VITE_BASE_PATH

RUN npm run build

FROM nginx:1.27-alpine

COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --retries=3 CMD wget -qO- http://127.0.0.1/health || exit 1
