# syntax=docker/dockerfile:1

# ---------- Etapa 1: build ----------
# Node solo compila la aplicación; no llega a la imagen final.
FROM node:24-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
# Caché de npm entre builds y reintentos ante cortes de red (ECONNRESET) al descargar paquetes
RUN --mount=type=cache,target=/root/.npm \
    npm ci --fetch-retries=5 --fetch-retry-mintimeout=20000 --fetch-retry-maxtimeout=120000

COPY . .
RUN npm run build

# ---------- Etapa 2: nginx ----------
FROM nginx:alpine

# nginx procesa /etc/nginx/templates/*.template al arrancar (envsubst) y genera
# /etc/nginx/conf.d/default.conf con la URL del API Gateway de cada entorno.
ENV API_GATEWAY_URL=http://api-gateway:3000
COPY nginx.conf /etc/nginx/templates/default.conf.template

# Solo los archivos estáticos compilados
COPY --from=build /app/dist/gestion-academica/browser /usr/share/nginx/html

EXPOSE 80
