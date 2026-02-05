FROM node:25-trixie-slim

WORKDIR /mercury

COPY tsconfig.json ./
COPY package.json ./
COPY package-lock.json ./

RUN npm install

COPY config.json ./

COPY prisma/schema.prisma prisma/schema.prisma
COPY prisma/migrations prisma/migrations

RUN npx prisma generate

COPY main.ts .
COPY index.ts .
COPY src src/

RUN npx tsc

CMD ["npm", "run", "entrypoint"]