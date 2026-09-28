FROM node:20-slim
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npx prisma generate && npm run build
EXPOSE 3001
# db push keeps setup to a single command for reviewers; seed is idempotent
CMD ["sh", "-c", "npx prisma db push --skip-generate && npx prisma db seed && node dist/main"]
