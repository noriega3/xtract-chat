FROM node:alpine

ENV NPM_CONFIG_LOGLEVEL warn

RUN npm install nodemon -g

# Create app directory
WORKDIR /usr/src/app

COPY ./app/package* ./
RUN npm install

COPY ./app .

EXPOSE 7776
EXPOSE 8080

CMD [ "npm", "run", "start.dev" ]
