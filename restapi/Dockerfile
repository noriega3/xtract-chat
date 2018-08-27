FROM node:alpine

#ENV NPM_CONFIG_LOGLEVEL info
ENV NPM_CONFIG_PREFIX=/home/node/.npm-global
ENV PATH=$PATH:/home/node/.npm-global/bin

ENV NODE_ENV=development
ENV DEBUG=*,-not_this,-bull*,-ioredis*

RUN npm install nodemon -g

# Create app directory
WORKDIR /usr/src

COPY ./app/nodemon.json ./
COPY ./app/package*.json ./

#fix bcrypt
RUN apk add --no-cache --virtual deps \
  python \
  build-base \
  && npm install \
  && apk del deps

EXPOSE 6656
CMD [ "nodemon", "-L", "app/bin/www" ]
