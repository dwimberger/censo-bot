var debug = require('debug')('admin');
var moment = require('moment');
var paramTypes = require('mivir-telegram-bot-api').paramTypes;
var ADMIN_ID = parseInt(process.env.TELEGRAM_ADMIN_ID);

function ensureAdmin(msg, bot) {
  debug('ensureAdmin %j', msg);
  if (msg.from.id === ADMIN_ID) {
    return true;
  } else {
    bot.sendMessage(msg.from.id, 'Sorry ' +
      // jscs:disable requireCamelCaseOrUpperCaseIdentifiers
      msg.from.first_name +
      // jscs:enable requireCamelCaseOrUpperCaseIdentifiers
      ' you are not authorized to ask me for this.'
    );
    return false;
  }
}

var registerActions = function(bot, mongo) {
  debug('Registering admin actions');
  var list = [];

  list.push('/aconfirm [user] [level] - confirm a new user');
  bot.onCommand('aconfirm', [paramTypes.WORD, paramTypes.NUM],
      function(bot, msg, params, next, done) {
        if (!ensureAdmin(msg, bot)) {
          done();
          return;
        }
        handleConfirm(bot, mongo, msg, params);
        done();
      });
  list.push('/alevel [user] [level] - assign level to a user');
  bot.onCommand('alevel', [paramTypes.WORD, paramTypes.NUM],
      function(bot, msg, params, next, done) {
        if (!ensureAdmin(msg, bot)) {
          done();
          return;
        }
        handleLevelUp(bot, mongo, msg, params);
        done();
      });
  list.push('/alist [prefix] - list user');
  bot.onCommand('alist', [paramTypes.WORD],
      function(bot, msg, params, next, done) {
        if (!ensureAdmin(msg, bot)) {
          done();
          return;
        }
        handleList(bot, mongo, msg, params);
        done();
      });
  list.push('/anew - list all new unconfirmed users');
  bot.onCommand('anew', [], function(bot, msg, params, next, done) {
    if (!ensureAdmin(msg, bot)) {
      done();
      return;
    }
    handleListUnconfirmed(bot, mongo, msg, params);
    done();
  });
  list.push('/aremove [user] - remove a user');
  bot.onCommand('aremove', [paramTypes.WORD],
      function(bot, msg, params, next, done) {
        if (!ensureAdmin(msg, bot)) {
          done();
          return;
        }
        handleRemove(bot, mongo, msg, params);
        done();
      });
  list.push('/aroles [user] [roles] - authorize roles');
  bot.onCommand('aroles', [paramTypes.WORD, paramTypes.STRING],
        function(bot, msg, params, next, done) {
          console.log('aroles %j', params);
          if (!ensureAdmin(msg, bot)) {
            done();
            return;
          }
          handleRoles(bot, mongo, msg, params);
          done();
        });
  list.push('/ahelp - Help for admin actions');
  bot.onCommand('ahelp', [],
      function(bot, msg, params, next, done) {
    if (!ensureAdmin(msg, bot)) {
      done();
      return;
    }
    bot.sendMessage(msg.from.id, list.join('\n'));
    done();
  });
};

var handleListUnconfirmed = function(bot, mongo, msg, params) {
  var q = {'profile.confirmed': false};
  mongo.findUsers(q, function(err, docs) {
    debug('findUsers called back q=%j err=%j docs=%j', q, err, docs);
    if (err) {
      debug(err);
      bot.sendMessage(msg.from.id, 'Sorry, I am not able to answer currently.');
    } else if (docs.length === 0) {
      bot.sendMessage(msg.from.id, 'There are currently no unconfirmed users.');
    } else {
      var list = [];
      docs.forEach(function(user, idx, array) {
        var entry = user.services.telegram;
        list.push(entry.username + ' (' + entry.uuid + ')');
      });
      bot.sendMessage(msg.from.id, list.join('\n'));
    }
  });

};

var handleList = function(bot, mongo, msg, params) {
  var q;
  if (params && params.length === 1) {
    q = {'services.telegram.username': {'$regex': params[0] + '.*'}};
  }

  mongo.findUsers(q, function(err, docs) {
    debug('findUsers called back q=%j err=%j docs=%j', q, err, docs);
    if (err) {
      debug(err);
      bot.sendMessage(msg.from.id, 'Sorry, I am not able to answer currently.');
    } else if (docs.length === 0) {
      bot.sendMessage(msg.from.id, 'There are currently no users.');
    } else {
      var list = [];
      docs.forEach(function(user, idx, array) {
        var entry = user.services.telegram;
        list.push(
          entry.username +
          ' (' + entry.uuid + ')' +
          ((user.profile.confirmed) ? ' is confirmed ' : ' is unconfirmed ') +
          ' Level: ' + user.profile.level
        );
      });
      bot.sendMessage(msg.from.id, list.join('\n'));
    }
  });
};

var handleConfirm = function(bot, mongo, msg, params) {

  debug('handleConfirm msg=%j params=%j', msg, params);

  if (params.length < 1) {
    bot.sendMessage(msg.from.id, 'Username required.');
    return;
  }
  var q = {'services.telegram.username': params[0]};
  var level = 1;
  if (params.length === 2) {
    level = Number.parseInt(params[1]);
  }
  var set = {
    $set: {
      'profile': {
          confirmed: true,
          level: level
        }
    }
  };

  mongo.updateUser(
     q,
     set,
     function(err, updated) {
      debug('Update callback q=%j err=%j item=%j', q, err, updated);
      if (err || !updated || !updated.value ||
          !updated.value.services.telegram.uuid) {
        bot.sendMessage(msg.from.id, 'No such user.');
      } else {
        bot.sendMessage(msg.from.id, 'User confirmed.');
        bot.sendMessage(
          updated.value.services.telegram.uuid,
          'You have been confirmed by ' + msg.from.username
        );
      }
    });
};

var handleLevelUp = function(bot, mongo, msg, params) {

  if (params.length !== 2) {
    bot.sendMessage(msg.from.id, 'Username and level required.');
    return;
  }
  var q = {'services.telegram.username': params[0]};
  var newLevel = Number.parseInt(params[1]);
  var set = {
    $set: {
      'profile.level': newLevel
    }
  };
  mongo.updateUser(
      q,
     set,
     function(err, updated) {
      //debug('Update callback q=%j err=%j item=%j', q, err, updated);
      if (err) {
        bot.sendMessage(msg.from.id, 'No such user.');
      } else {
        //Notify the admin
        bot.sendMessage(
          msg.from.id, 'Level of ' + params[0] + ' set to ' + newLevel
        );
        //Notify the user that was leveled
        bot.sendMessage(
          updated.value.uuid,
          'Your level has been set to ' +
          newLevel +
          ' by ' + msg.from.username
        );
      }
    });
};

var handleRemove = function(bot, mongo, msg, params) {
  if (params.length !== 1) {
    bot.sendMessage(msg.from.id, 'Username required.');
    return;
  }
  var q = {'services.telegram.username': params[0]};

  mongo.removeUser(q, function(removed) {
    if (!removed) {
      bot.sendMessage(msg.from.id, 'No such user.');
    } else {
      bot.sendMessage(msg.from.id, 'User removed.');
    }
  });

};

var handleRoles = function(bot, mongo, msg, params) {

  debug('handleRoles msg=%j params=%j', msg, params);

  if (params.length < 1) {
    bot.sendMessage(msg.from.id, 'Username required.');
    return;
  }
  var q = {'services.telegram.username': params[0]};
  var set = {
    $set: {
      'roles.__global_roles__': params[1].split(',')
    }
  };

  mongo.updateUser(
     q,
     set,
     function(err, updated) {
      debug('Update callback q=%j err=%j item=%j', q, err, updated);
      if (err || !updated || !updated.value ||
          !updated.value.services.telegram.uuid) {
        bot.sendMessage(msg.from.id, 'No such user.');
      } else {
        bot.sendMessage(msg.from.id, 'User roles updated.');
      }
    });
};

exports.registerActions = registerActions;
exports.adminId = ADMIN_ID;
