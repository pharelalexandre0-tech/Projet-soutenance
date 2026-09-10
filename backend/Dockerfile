FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .
RUN mkdir -p storage/pdfs

ENV PORT=10000
EXPOSE 10000

CMD ["node", "src/server.js"]
