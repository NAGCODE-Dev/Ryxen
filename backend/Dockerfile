FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY src ./src
COPY .env.example ./.env.example

ENV NODE_ENV=production
EXPOSE 8787

CMD ["npm", "run", "start"]
