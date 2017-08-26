var debug = require('debug')('items');

const request = require('request');
const moment = require('moment');
const render = require('json-templater/string');
const noVerifyTemplate =
'{{name}}\n' +
'🏷  {{inventoryNumber}}\n' +
'📋  {{description}}\n' +
'🏢  {{department}}\n' +
'🗄  {{storage}}\n' +
'🤝  {{caretaker}}\n';

const verifyTemplate =
'{{name}}\n' +
'🏷  {{inventoryNumber}}\n' +
'📋  {{description}}\n' +
'🏢  {{department}}\n' +
'🗄  {{storage}}\n' +
'🤝  {{caretaker}}\n' +
'🕑  {{verificationDate}}\n';

// Connect for QR service
const qrService = process.env.QR_SERVICE_URL;

var _mongo;

function ensureUser(ctx, level) {
  if (level === undefined) {
    level = 1;
  }
  debug('ensureUser %j level=%d', ctx.message, level);
  return new Promise(function(resolve, reject) {
    _mongo.hasConfirmedUserWithLevel(ctx.from.id, level, function(result) {
      if (!result) {
        reject(ctx);
      } else {
        resolve(ctx);
      }
    });
  });
};

var sendIamSorry = function(ctx) {
  debug('sendIamSorry %j', ctx.from);
  ctx.reply('Sorry ' +
    // jscs:disable requireCamelCaseOrUpperCaseIdentifiers
    ctx.from.first_name +
    // jscs:enable requireCamelCaseOrUpperCaseIdentifiers
    ' you are not authorized to ask me for this.'
  );
};

var sendError = function(ctx, e) {
  debug('sendError on message from %j, error = %j', ctx.from, e);
  ctx.reply('Sorry ' +
    // jscs:disable requireCamelCaseOrUpperCaseIdentifiers
    ctx.from.first_name +
    // jscs:enable requireCamelCaseOrUpperCaseIdentifiers
    ' something went terribly wrong'
  );
};

function handlePhoto(ctx) {
  debug('handlePhoto msg=%j photoUrl=%j', ctx.message, ctx.state.fileLink);
  var furl = ctx.state.fileLink;
  request.post({
      url: qrService,
      formData: {
        image: {
            value: request(furl),
            options: {
              filename: 'image.jpg',
              contentType: 'image/jpg',
              // jscs:disable requireCamelCaseOrUpperCaseIdentifiers
              contentLength: ctx.state.fileSize
              // jscs:enable requireCamelCaseOrUpperCaseIdentifiers
            }
          }
      }
    },
    function(err, response, body) {
            if (response.statusCode === 200) {
              if (!err && body) {
                var result = JSON.parse(body);
                var parts = result.res.split('/');
                var uuid = parts[Math.max(0, parts.length - 1)];
                debug('\n\nUUID = %j', uuid);
                _mongo.getItemByUUID(uuid, function(merr, data) {
                  debug('Item: %j', data);
                  if (!data || !data.uuid) {
                    ctx.reply(result.res + ' does not identify a known item.');
                    return;
                  }
                  if (!merr) {
                    var template = noVerifyTemplate;
                    if (data.requiresVerification) {
                      template = verifyTemplate;
                      var vd = moment(data.verificationDate)
                        .format('MM/DD/YYYY');
                      data.verificationDate = vd;
                    }
                    var template = (data.requiresVerification) ?
                      verifyTemplate : noVerifyTemplate;
                    ctx.reply(
                      render(template, data), {
                        parseMode: 'Markdown'
                      }
                    );
                  } else {
                    ctx.reply('Error trying to decode.');
                  }
                });
              } else {
                ctx.reply('Error trying to decode.');
              }
            } else {
              ctx.reply('Failed to decode.');
            }
          });
}

exports.registerActions = function(bot, mongo) {
  _mongo = mongo;
  // Photo Handler
  const photoPlugin = (ctx, next) => {
    var idx = 0;
    if (ctx.message.photo.length > 1) {
      idx = 1;
    }
    return bot.telegram.getFileLink(ctx.message.photo[idx])
      .then((link) => {
        ctx.state.fileLink = link;
        // jscs:disable requireCamelCaseOrUpperCaseIdentifiers
        ctx.state.fileSize = ctx.message.photo[idx].file_size;
        // jscs:enable requireCamelCaseOrUpperCaseIdentifiers
        return next();
      });
  };
  bot.on('photo', photoPlugin, (ctx) => {
    ensureUser(ctx, 20).then(
      (ctx) => handlePhoto(ctx), //resolve
      (ctx) => sendIamSorry(ctx)   //reject
    ).catch(e => sendError(ctx, e));
  });
};//registerActions
