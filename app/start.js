var debug = require('debug')('start');
var moment = require('moment');
const ADMIN_ID = parseInt(process.env.TELEGRAM_ADMIN_ID);

var _mongo;

function handleStart(ctx) {
  var timestamp = moment.unix(msg.date);
  var params = ctx.state.command.splitArgs;
  debug('handleStart msg=%j params=%j', ctx.message, params);
  if (params[0] === '') {
    ctx.reply('Please start from the weblink in Censo, thank you.');
    return;
  }
  _mongo.hasWebUser(params[0], function(userExists) {
    debug('User exists? %d %j', msg.from.id, userExists);
    debug('%j', msg);
    if (!userExists) {
      ctx.reply(
        // jscs:disable requireCamelCaseOrUpperCaseIdentifiers
        'Hello ' + msg.from.first_name + ' please visit from the web.'
        // jscs:enable requireCamelCaseOrUpperCaseIdentifiers
      );
      return;
    }
    debug('params = %j', params);
    var q = {_id: params[0]};
    debug('q %j', q);
    _mongo.getUser(q, function(err, user) {
      if (err) {
        debug('Failed %j', err);
        return;
      }
      debug('User is %j', user);
      user.services.telegram = {
          uuid: msg.from.id,
          username: msg.from.username,
          // jscs:disable requireCamelCaseOrUpperCaseIdentifiers
          firstname: msg.from.first_name,
          // jscs:enable requireCamelCaseOrUpperCaseIdentifiers
        };
      user.profile.confirmed = false;
      user.profile.level = 0;
      debug('Updating user to %j', user);
      _mongo.updateUser(q, user, function(err) {
        if (err) {
          debug(err);
        } else {
          // jscs:disable requireCamelCaseOrUpperCaseIdentifiers
          //notify user
          ctx.reply('Hello ' + msg.chat.first_name);
          //notify admin
          ctx.telegram.sendMessage(
            ADMIN_ID, msg.from.first_name +
            ' (' + msg.from.username + ') has joined and needs confirmation.'
          );
          // jscs:enable requireCamelCaseOrUpperCaseIdentifiers
        }
      });//mongo.updateUser
    });//mongo.getUser
  });//mongo.hasWebUser

};

exports.registerActions = function(bot, mongo) {
  _mongo = mongo;
  bot.command('start', (ctx) => handleStart(ctx));
};//registerActions
