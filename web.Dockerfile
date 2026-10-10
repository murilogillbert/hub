# OpenDriverHub Web — build Vite e serve estático via Nginx (porta 8080)
# Contexto de build = raiz do repositório hub.
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG VITE_API_BASE_URL=/api/v1
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ARG VITE_OPENDRIVER_API_URL=
ENV VITE_OPENDRIVER_API_URL=$VITE_OPENDRIVER_API_URL
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
# Configuração do nginx como *template*: a imagem oficial aplica `envsubst` em
# /etc/nginx/templates/*.template na partida e grava /etc/nginx/conf.d/default.conf.
# Contém o SPA fallback (React Router) e o redirecionamento do QR Code (/qrcode-transfer).
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
# Links das lojas usados por /qrcode-transfer. DEFINIDOS (mesmo vazios) de propósito: o
# envsubst só troca variável que existe no ambiente, e uma ausente deixaria "${...}" literal
# no nginx.conf e o contêiner não subiria. Sobrescreva no Coolify (variáveis de ambiente do
# hub-frontend) e reimplante. Vazio = a pessoa vê a página "em breve" em vez de link quebrado.
ENV QR_ANDROID_URL="https://play.google.com/store/apps/details?id=br.com.opendriver.app&referrer=utm_source%3Dqrcode%26utm_medium%3Dtransfer%26utm_campaign%3Dopendriver"
ENV QR_IOS_URL=""
ENV QR_ANDROID_HUB_URL="https://play.google.com/store/apps/details?id=br.com.opendriverhub.app&referrer=utm_source%3Dqrcode%26utm_medium%3Dtransfer%26utm_campaign%3Dhub"
ENV QR_IOS_HUB_URL=""
ENV QR_ANDROID_ADS_URL="https://play.google.com/store/apps/details?id=br.com.opendriver.ads&referrer=utm_source%3Dqrcode%26utm_medium%3Dtransfer%26utm_campaign%3Dads"
ENV QR_IOS_ADS_URL=""
EXPOSE 8080
