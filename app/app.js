var debug = require('debug')('app');

const Telegraf = require('telegraf');
const commandParts = require('telegraf-command-parts');
const startHandler = require('./start');
const adminHandler = require('./admin');
const itemsHandler = require('./items');
const ADMIN_ID = 140897148;

var BOT_TOKEN;

// Connect mongo database
var mongoService = process.env.MONGO_URL;

// Mongo DB service
var mongo = require('./mongo');
var BOT_TOKEN = process.env.BOT_TOKEN;
mongo.connect(
  mongoService,
  function() {
    debug('Connected mongo.');
  },
  function(data) {
    if (data && data.type && data.type === 'msg') {
      if (data.to === -1) {
        data.to = adminHandler.adminId;
      }
      bot.sendMessage(
       data.to,
       data.msg
      );
    }
  }

);

//Exit handlers
function exitHandler(options, err) {
  if (options.cleanup) {
    console.log('Quitting and Cleaning up');
    mongo.disconnect();
  }
  if (err) {
    debug(err.stack);
  }
  if (options.exit) {
    process.exit();
  }
}

//do something when app is closing
process.on('exit', exitHandler.bind(null, {cleanup: true}));

//catches ctrl+c event
process.on('SIGINT', exitHandler.bind(null, {exit: true}));

//catches uncaught exceptions
process.on('uncaughtException', exitHandler.bind(null, {exit: true}));

// Setup bot
const bot = new Telegraf(BOT_TOKEN);
// Install middleware
bot.use(commandParts());

// Register actions
startHandler.registerActions(bot, mongo);
adminHandler.registerActions(bot, mongo);
itemsHandler.registerActions(bot, mongo);

// Echo handler for bot monitoring /e [whatever]
bot.command('e', (ctx) => ctx.reply(ctx.state.command.args));

// Filter for short text messages
bot.filter(({message}) => !message || message.text.length > 2);

// Start polling
bot.startPolling();
