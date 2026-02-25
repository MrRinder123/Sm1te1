FROM node:20-alpine
WORKDIR /app
COPY package.json ./
COPY server/package.json ./server/package.json
COPY shared/package.json ./shared/package.json
RUN npm install
COPY server ./server
COPY shared ./shared
WORKDIR /app/server
RUN npm run prisma:generate
EXPOSE 4000
CMD ["npm", "run", "dev"]
