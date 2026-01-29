FROM 25-trixie-slim

WORKDIR /mercury

COPY package*.json ./

RUN npm install

COPY prisma/schema.prisma prisma/schema.prisma
COPY prisma/migrations prisma/migrations

RUN npx prisma generate

COPY src src/
COPY main.ts .
COPY index.ts .

CMD ["npm", "run", "entrypoint"]