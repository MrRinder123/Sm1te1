FROM node:20-alpine
WORKDIR /app
COPY package.json ./
COPY client/package.json ./client/package.json
COPY shared/package.json ./shared/package.json
RUN npm install
COPY client ./client
COPY shared ./shared
WORKDIR /app/client
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
