var debug = require('debug')('mongo');

var mongoDb;
var usersC;
var queueC;
var myMessageHandler;
var itemsC;

/*
Queue
*/
function onQueueCollection(err, collection) {
  debug('=> onQueueCollection');
  if (err || !collection) {
    debug('onQueueCollection error %j %j ', err, collection);
  }
  collection.insert({end: false, processed: true}, function(err) {
      debug('insert');
      var cursor = collection.find({});
      cursor.addCursorFlag('tailable', true);
      cursor.addCursorFlag('awaitData', true);
      var cursorStream = cursor.stream();

      cursorStream.on('end', function() {
        debug('Stream ended');
      });
      cursorStream.on('data', function(data) {
        //console.log(data);
        if (myMessageHandler && data.processed !== true && data.type) {
          myMessageHandler(data);
          // Update the document with an atomic operator
          collection.updateOne({_id: data._id}, {$set: {processed: true}},
             function(err) {
            debug('UPDATED %j', data._id);
          });
        } else {
          debug('Message handler is null.');
        }
      });

    });
}

var connect = function(mongoService, callback, messageHandler) {
  myMessageHandler = messageHandler;
  debug('trying to connect %j', mongoService);
  var MongoClient = require('mongodb').MongoClient;
  MongoClient.connect(mongoService, function(err, db) {
    if (!err) {
      debug('censo-iiw connected %', mongoService);
      mongoDb = db;
      usersC = mongoDb.collection('users');
      itemsC = mongoDb.collection('items');
      queueC = mongoDb.createCollection(
        'queue', {
          capped: true,
          size: 1000,
          max: 100
        },
        onQueueCollection
      );

      ensureIndices();
      if (callback) {
        callback();
      }
    } else {
      debug(err);
      if (callback) {
        callback();
      }
    }
  });
};

var disconnect = function(callback) {
  mongoDb.close();
};

var ensureIndices = function() {
  if (usersC) {
    usersC.ensureIndex({'services.telegram.uuid': 1}, {unique: true});
    usersC.ensureIndex({'services.telegram.username': 1});
  }
  if (itemsC) {
    itemsC.ensureIndex({'uuid': 1}, {unique: true});
  }
};

/* Users */
var findUsers = function(q, callback) {
  usersC.find(q).toArray(function(err, docs) {
    if (err || !docs) {
      debug('Failed to query user %s', err);
      callback(err);
    } else {
      callback(null, docs);
    }
  });
};

var hasWebUser = function(id, callback) {
  try {
    var q = {_id: id};
    usersC.find(q).toArray(function(err, docs) {
      debug('callback on hasWebUser q=%j err=%j docs=%j', q, err, docs);
      if (err || !docs) {
        debug('Failed to query user %s', err);
        callback(false);
      } else {
        callback(docs.length > 0);
      }
    });
  } catch (e) {
    debug('%j', e);
  }
};

var hasUser = function(id, callback) {
  var q = {'services.telegram.uuid': id};
  usersC.find(q).toArray(function(err, docs) {
    debug('callback on hasUser q=%j err=%j docs=%j', q, err, docs);
    if (err || !docs) {
      debug('Failed to query user %s', err);
      callback(false);
    } else {
      callback(docs.length > 0);
    }
  });
};

var hasConfirmedUserWithLevel = function(id, level, callback) {
  var q = {$and:
    [
      {'services.telegram.uuid': id},
      {'profile.confirmed': true},
      {'profile.level': {$gte: level}}
    ]
  };
  usersC.find(q).toArray(function(err, docs) {
    debug('callback on hasConfirmedUserWithLevel q=%j err=%j docs=%j',
    q, err, docs);
    if (err || !docs) {
      debug('Failed to query user %s', err);
      callback(false);
    } else {
      callback(docs.length > 0);
    }
  });
};

var addUser = function(user, callback) {
  usersC.insertOne(user, callback);
};

var removeUser = function(q, callback) {
  debug('Removing %j', q);
  usersC.removeOne(q, function(err, r) {
    debug('r=%j', r);
    if (err) {
      debug('Failed to remove user %s', err);
      callback(false);
    } else {
      callback(r.result.n === 1);
    }
  });
};

var updateUser = function(q, updates, callback) {
  debug('Updating %j with %j', q, updates);
  usersC.findOneAndUpdate(q, updates, function(err, item) {
    if (err) {
      debug('Failed to update user %s', err);
      callback(null);
    } else {
      callback(null, item);
    }
  });
};

var getUser = function(q, callback) {
  debug('=>getUser');
  usersC.findOne(q, callback);
};

var getItem = function(q, callback) {
  debug('=>getItem');
  itemsC.findOne(q, callback);
};
var getItemByUUID = function(uuid, callback) {
  var q = {uuid: uuid};
  debug('getItemByUUID(%j)', q);
  itemsC.findOne(q, callback);
};

exports.connect = connect;
exports.disconnect = disconnect;
exports.hasWebUser = hasWebUser;
exports.hasUser = hasUser;
exports.hasConfirmedUserWithLevel = hasConfirmedUserWithLevel;
exports.addUser = addUser;
exports.findUsers = findUsers;
exports.getUser = getUser;
exports.removeUser = removeUser;
exports.updateUser = updateUser;
exports.getItem = getItem;
exports.getItemByUUID = getItemByUUID;
