FROM node:lts
WORKDIR /app
COPY . .
RUN npm install && npm -w packages/harness run build
ENTRYPOINT ["node", "packages/harness/dist/cli.js"]
