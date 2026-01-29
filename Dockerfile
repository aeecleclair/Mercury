FROM node:25-trixie-slim

WORKDIR /mercury

COPY package*.json ./

RUN npm install

COPY prisma/schema.prisma prisma/schema.prisma
COPY prisma/migrations prisma/migrations

RUN npx prisma generate

COPY src src/
COPY main.ts .
COPY index.ts .

RUN npx prisma migrate deploy
RUN npx prisma generate
RUN tsc

CMD ["node", "dist/index.js"]