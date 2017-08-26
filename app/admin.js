var debug = require('debug')('admin');
var moment = require('moment');
const ADMIN_ID = parseInt(process.env.TELEGRAM_ADMIN_ID);

var _mongo;

function ensureAdmin(ctx) {
  debug('ensureAdmin %j', ctx.message);
  return new Promise(function(resolve, reject) {
      if (ctx.from.id === ADMIN_ID) {
        return resolve(ctx);
      } else {
        reject(ctx);
      }
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

var sendError = function(ctx) {
  debug('sendError %j', ctx.from);
  ctx.reply('Sorry ' +
    // jscs:disable requireCamelCaseOrUpperCaseIdentifiers
    ctx.from.first_name +
    // jscs:enable requireCamelCaseOrUpperCaseIdentifiers
    ' something went terribly wrong'
  );
};

var handleConfirm = function(ctx) {
  var params = ctx.state.command.splitArgs;
  debug('handleConfirm msg=%j params=%j', ctx.message, params);

  if (params.length < 1) {
    ctx.reply('User id required.');
    return;
  }
  if (isNaN(params[0])) {
    ctx.reply('User id must be a number.');
    return;
  }
  var who = Number.parseInt(params[0]);

  var q = {'services.telegram.uuid': who};
  var level = 1;
  if (params.length === 2) {
    if (isNaN(params[1])) {
      ctx.reply('Level must be a number.');
      return;
    }
    level = Number.parseInt(params[1]);;
  }
  var set = {
    $set: {
      'profile': {
          confirmed: true,
          level: level
        }
    }
  };

  _mongo.updateUser(
     q,
     set,
     function(err, updated) {
      debug('Update callback q=%j err=%j item=%j', q, err, updated);
      if (err || !updated || !updated.value ||
          !updated.value.services.telegram.uuid) {
        ctx.reply('No such user.');
      } else {
        ctx.reply('User confirmed.');
        ctx.telegram.sendMessage(
          updated.value.services.telegram.uuid,
          'You have been confirmed by ' + ctx.from.username + '.'
        );
      }
    });
};

var handleLevel = function(ctx) {
  var params = ctx.state.command.splitArgs;
  debug('handleLevel msg=%j params=%j', ctx.message, params);
  if (params.length !== 2) {
    ctx.reply('User id and level required.');
    return;
  }
  if (isNaN(params[0])) {
    ctx.reply('User id must be a number.');
    return;
  }
  if (isNaN(params[1])) {
    ctx.reply('Level must be a number.');
    return;
  }
  var who = Number.parseInt(params[0]);
  var newLevel = Number.parseInt(params[1]);

  var q = {'services.telegram.uuid': who};
  var set = {
    $set: {
      'profile.level': newLevel
    }
  };
  _mongo.updateUser(
      q,
     set,
     function(err, updated) {
      //debug('Update callback q=%j err=%j item=%j', q, err, updated);
      if (err) {
        ctx.reply('No such user.');
      } else {
        //Notify the admin
        ctx.reply('Level of ' + who + ' set to ' + newLevel
        );
        //Notify the user that was leveled
        debug('Updated user %j', updated.value);
        ctx.telegram.sendMessage(
          updated.value.services.telegram.uuid,
          'Your level has been set to ' +
          newLevel +
          ' by ' + ctx.from.username
        );
      }
    });
};

var handleList = function(ctx) {
  var params = ctx.state.command.splitArgs;
  debug('handleList msg=%j params=%j', ctx.message, params);

  var q;
  if (params && params.length === 1) {
    q = {'services.telegram.username': {'$regex': params[0] + '.*'}};
  }

  _mongo.findUsers(q, function(err, docs) {
    debug('findUsers called back q=%j err=%j docs=%j', q, err, docs);
    if (err) {
      debug(err);
      ctx.reply('Sorry, I am not able to answer currently.');
    } else if (docs.length === 0) {
      ctx.reply('There are currently no users.');
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
      ctx.reply(list.join('\n'));
    }
  });
};

var handleListUnconfirmed = function(ctx) {
  var params = ctx.state.command.splitArgs;
  debug('handleListUnconfirmed msg=%j params=%j', ctx.message, params);

  var q = {'profile.confirmed': false};
  _mongo.findUsers(q, function(err, docs) {
    debug('findUsers called back q=%j err=%j docs=%j', q, err, docs);
    if (err) {
      debug(err);
      ctx.reply('Sorry, I am not able to answer currently.');
    } else if (docs.length === 0) {
      ctx.reply('There are currently no unconfirmed users.');
    } else {
      var list = [];
      docs.forEach(function(user, idx, array) {
        var entry = user.services.telegram;
        list.push(entry.username + ' (' + entry.uuid + ')');
      });
      ctx.reply(list.join('\n'));
    }
  });

};

var handleRemove = function(ctx) {
  var params = ctx.state.command.splitArgs;
  debug('handleRemove msg=%j params=%j', ctx.message, params);
  if (params.length !== 1) {
    ctx.reply('User id required.');
    return;
  }
  if (isNaN(params[0])) {
    ctx.reply('User id must be a number.');
    return;
  }
  var who = Number.parseInt(params[0]);
  var q = {'services.telegram.uuid': who};

  _mongo.removeUser(q, function(removed) {
    if (!removed) {
      ctx.reply('No such user.');
    } else {
      ctx.reply('User removed.');
    }
  });
};

var handleRoles = function(ctx) {
  var params = ctx.state.command.splitArgs;
  debug('handleRoles msg=%j params=%j', ctx.message, params);

  if (params.length < 2) {
    ctx.reply('User id and role required.');
    return;
  }
  if (isNaN(params[0])) {
    ctx.reply('User id must be a number.');
    return;
  }
  var who = Number.parseInt(params[0]);
  var q = {'services.telegram.uuid': who};
  var set = {
    $set: {
      'roles.__global_roles__': params[1].split(',')
    }
  };

  _mongo.updateUser(
     q,
     set,
     function(err, updated) {
      debug('Update callback q=%j err=%j item=%j', q, err, updated);
      if (err || !updated || !updated.value ||
          !updated.value.services.telegram.uuid) {
        ctx.reply('No such user.');
      } else {
        ctx.reply('User roles updated.');
      }
    });
};

exports.registerActions = function(bot, mongo, redis) {
  _mongo = mongo;

  var list = [];
  list.push('/aconfirm [user] [level] - confirm a new user');
  bot.command('aconfirm', (ctx) => {
    ensureAdmin(ctx).then(
      (ctx) => handleConfirm(ctx), //resolve
      (ctx) => sendIamSorry(ctx)   //reject
    )
    .catch(e => sendError(ctx));
  });

  list.push('/alevel [user] [level] - assign level to a user');
  bot.command('alevel', (ctx) => {
    ensureAdmin(ctx)
      .then(
        (ctx) => handleLevel(ctx), //resolve
        (ctx) => sendIamSorry(ctx)   //reject
      )
      .catch(e => sendError(ctx));
  });

  list.push('/alist [prefix] - list user');
  bot.command('alist', (ctx) => {
    ensureAdmin(ctx).then(
      (ctx) => handleList(ctx), //resolve
      (ctx) => sendIamSorry(ctx)   //reject
    ).catch(e => sendError(ctx));
  });

  list.push('/anew - list all new unconfirmed users');
  bot.command('anew', (ctx) => {
    ensureAdmin(ctx).then(
      (ctx) => handleListUnconfirmed(ctx), //resolve
      (ctx) => sendIamSorry(ctx)   //reject
    ).catch(e => sendError(ctx));
  });

  list.push('/aremove [user] - remove a user');
  bot.command('aremove', (ctx) => {
    ensureAdmin(ctx).then(
      (ctx) => handleRemove(ctx), //resolve
      (ctx) => sendIamSorry(ctx)   //reject
    ).catch(e => sendError(ctx));
  });

  list.push('/aroles [user] [roles] - authorize roles');
  bot.command('aroles', (ctx) => {
    ensureAdmin(ctx).then(
      (ctx) => handleRoles(ctx), //resolve
      (ctx) => sendIamSorry(ctx)   //reject
    ).catch(e => sendError(ctx));
  });

  list.push('/ahelp - Help for admin actions');
  bot.command('ahelp', (ctx) => {
    ensureAdmin(ctx).then(
      (ctx) => ctx.reply(list.join('\n')), //resolve
      (ctx) => sendIamSorry(ctx)   //reject
    ).catch(e => sendError(ctx));
  });

};
