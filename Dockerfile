FROM node:24-slim

WORKDIR /app

RUN npm install -g @angular/cli

COPY package*.json ./
RUN npm install

COPY . .

COPY docker/entrypoint.sh /usr/local/bin/mnscloud-app-entrypoint
RUN chmod +x /usr/local/bin/mnscloud-app-entrypoint

EXPOSE 4200

ENTRYPOINT ["mnscloud-app-entrypoint"]
CMD ["npm", "run", "start"]
