var debug = require('debug')('app');
var BOT_TOKEN;
var BOT_HOOK_TOKEN;

var Bot = require('mivir-telegram-bot-api').Bot;
var paramTypes = require('mivir-telegram-bot-api').paramTypes;
var startHandler = require('./start');
var adminHandler = require('./admin');
var request = require('request');
var moment = require('moment');
var render = require('json-templater/string');
var noVerifyTemplate =
'{{name}}\n' +
'🏷  {{inventoryNumber}}\n' +
'📋  {{description}}\n' +
'🏢  {{department}}\n' +
'🗄  {{storage}}\n' +
'🤝  {{caretaker}}\n';

var verifyTemplate =
'{{name}}\n' +
'🏷  {{inventoryNumber}}\n' +
'📋  {{description}}\n' +
'🏢  {{department}}\n' +
'🗄  {{storage}}\n' +
'🤝  {{caretaker}}\n' +
'🕑  {{verificationDate}}\n';

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

// Setup polling way
var bot = new Bot(BOT_TOKEN);

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

function ensureUser(bot, msg, level, callback) {
  if (level === undefined) {
    level = 1;
  }
  mongo.hasConfirmedUserWithLevel(msg.from.id, level, function(result) {
    if (!result) {
      bot.sendMessage(
        msg.chat.id,
        'I am sorry, but you are not authorized to ask me for this. ' +
        'Please use /start and wait for confirmation.'
      );
    }
    callback(result);
  });
}

// ECHO Handler: Matches /e [whatever]
bot.onCommand('e', [paramTypes.REST],
    function(bot, msg, params, next, done) {
  var fromId = msg.from.id;
  var resp = params[0];
  bot.sendMessage(fromId, resp);
  done();
});

// START handler Matches /start
bot.onCommand('start', [paramTypes.WORD],
    function(bot, msg, params, next, done) {
  startHandler.handle(bot, mongo, msg, params);
  done();
});

function handlePhoto(bot, message) {
  // jscs:disable requireCamelCaseOrUpperCaseIdentifiers
  var file =
    bot.getFile(message.photo[Math.max(0, message.photo.length - 1)].file_id);
  file.then(
    function(data) {
      var furl = 'https://api.telegram.org/file/bot' +
                    BOT_TOKEN + '/' + data.result.file_path;
      request.post({
          url: 'http://localhost:32776/qr',
          formData: {
            image: {
                value:  request(furl),
                options: {
                  filename: 'image.jpg',
                  contentType: 'image/jpg',
                  contentLength: data.result.file_size
                  // jscs:enable requireCamelCaseOrUpperCaseIdentifiers

                }
              }
          }
        }, function(err, response, body) {
                      if (response.statusCode === 200) {
                        if (body) {
                          var result = JSON.parse(body);
                          var parts = result.res.split('/');
                          var uuid = parts[Math.max(0, parts.length - 1)];
                          debug('\n\nUUID = %j', uuid);
                          mongo.getItemByUUID(uuid, function(err, data) {
                            var template = noVerifyTemplate;
                            if (data.requiresVerification) {
                              template = verifyTemplate;
                              var vd = moment(data.verificationDate).format('MM/DD/YYYY');
                              data.verificationDate = vd;
                            }
                            if (!err) {
                              debug('ITEM: %j', data);
                              var template = (data.requiresVerification) ?
                                verifyTemplate : noVerifyTemplate;
                              bot.sendMessage(
                               message.chat.id,
                               render(template, data),
                               {
                                  parseMode: 'Markdown'
                                }
                              );
                            }
                          });
                        } else {
                          bot.sendMessage(message.chat.id, 'Failed to decode.');
                        }
                      }
                    });
    });
}
// Photo Handler
bot.on('photo', function(bot, message, next, done) {
    ensureUser(bot, message, 20, function(allowed) {
      if (allowed) {
        handlePhoto(bot, message);
      }
      done();
    });
  });

// Register Admin Handler
adminHandler.registerActions(bot, mongo);
