# Censo Telegram Bot

The Censo Telegram bot.

## Run the app locally

1. [Install Node.js][]
2. Checkout the code from GitHub
3. cd into the working copy directory
4. Run `npm install .` to install the app's dependencies
5. Run `npm start` to start the app, don't forget to prefix it with the required
environment variables, or export them on the shell.

[Install Node.js]: https://nodejs.org/en/download/

## Docker

1. Build image `docker build -t dwimberger/censo-bot .`
2. Run the image using  `docker run -e ... dwimberger/censo-bot`

You will need to set environment variables to have this up and running
1. Mongo DB: `-e "MONGO_URL=mongodb://localhost:32769/censo"`
2. Telegram Bot Token: `-e BOT_TOKEN=<xyz>`
3. Telegram Admin ID: `-e TELEGRAM_ADMIN_ID=<xyz>`
4. Debug Logs: `-e "DEBUG=app,mongo"`
