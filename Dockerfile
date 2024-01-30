FROM node

#Set Docker Container Timezone
ENV TZ=America/Detroit

#Set Environment Variables
ARG DISCORD_TOKEN=default_value
ARG OPENAI_API_KEY=default_value
ARG SENTRY_DSN=default_value
ENV DISCORD_TOKEN=${DISCORD_TOKEN}
ENV OPENAI_API_KEY=${OPENAI_API_KEY}
ENV SENTRY_DSN=${SENTRY_DSN}

#Create App Directory
RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

#Install app dependencies
COPY package*.json ./
RUN npm install

# Bundle app source
COPY . .

# Copy .env file
COPY .env.example ./env

CMD ["node", "server.js"]
EXPOSE 8940
