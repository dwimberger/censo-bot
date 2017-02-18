var debug = require('debug')('start');
var moment = require('moment');
var ADMIN_ID = 140897148;

exports.handle = function(bot, mongo, msg, params) {

  var timestamp = moment.unix(msg.date);
  console.log('msg=%j params=%j', msg, params);
  mongo.hasWebUser(params[0], function(userExists) {
    debug('User exists? %d %j', msg.from.id, userExists);
    debug('%j', msg);
    if (!userExists) {
      bot.sendMessage(
        msg.chat.id,
        // jscs:disable requireCamelCaseOrUpperCaseIdentifiers
        'Hello ' + msg.from.first_name + ' please visit from the web.'
        // jscs:enable requireCamelCaseOrUpperCaseIdentifiers
      );
      return;
    }
    debug('params = %j', params);
    var q = {_id: params[0]};
    debug('q %j', q);
    mongo.getUser(q, function(err, user) {
      if (err) {
        debug('Failed %j', err);
        return;
      }
      console.log('User is %j', user);
      user.services.telegram = {
          uuid: msg.from.id,
          username: msg.from.username,
          // jscs:disable requireCamelCaseOrUpperCaseIdentifiers
          firstname: msg.from.first_name,
          // jscs:enable requireCamelCaseOrUpperCaseIdentifiers
        };
      user.profile.confirmed = false;
      user.profile.level = 0;
      console.log('Updating user to %j', user);
      mongo.updateUser(q, user, function(err) {
        if (err) {
          debug(err);
        } else {
          // jscs:disable requireCamelCaseOrUpperCaseIdentifiers
          //notify user
          bot.sendMessage(msg.chat.id, 'Hello ' + msg.chat.first_name);
          //notify admin
          bot.sendMessage(
            ADMIN_ID, msg.from.first_name +
            ' (' + msg.from.username + ') has joined and needs confirmation'
          );
          // jscs:enable requireCamelCaseOrUpperCaseIdentifiers
        }
      });
    });
  });

};
