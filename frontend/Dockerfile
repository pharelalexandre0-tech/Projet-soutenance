FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

ENV PORT=10000
# Adresse publique du backend. En local (docker-compose) : http + backend:4000.
# Sur Render : https + le sous-domaine onrender.com du service backend
# (les deux services communiquent en HTTPS public, Render ne route pas de
# trafic privé vers un service gratuit).
ENV BACKEND_SCHEME=http
ENV BACKEND_HOST=backend:4000

EXPOSE 10000
