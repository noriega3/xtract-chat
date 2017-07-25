var net = require("net")
var redis = require("redis")
var bluebird = require("bluebird")
var cfg = require("./includes/config.js")
var util = require('./util.js')
var pmx = require('pmx').init({
    network       : true,  // Network monitoring at the application level
    ports         : true,  // Shows which ports your app is listening on (default: false)
});

var probe = pmx.probe();
var counter = probe.counter({
    name: 'Users Connected',
    action: function() { //optional
        //send call to server to increase # of users
    }
})

util.Cleanup(_onNodeClose);
bluebird.promisifyAll(redis.RedisClient.prototype)
bluebird.promisifyAll(redis.Multi.prototype)

var redisSub = require("./multiplayer/subscribe.js")

var cfgPubSub = cfg.pubsub
var cfgAPI = cfg.api
var cfgNet = cfg.net
var socketsList = []
var serversConnected = 0
var online = false

var pubsubServer    = redis.createClient(cfgPubSub)
var apiServer       = redis.createClient(cfgAPI)
var wsServer        = net.createServer()

var RedisError = function(message) { this.message = message; this.name = "RedisError"}
RedisError.prototype = Object.create(Error.prototype)

var RedisWatchError = function(redisKey, sessionId) {
    this.name = "RedisWatchError";
    var redisInstance = pubsubServer.duplicate();
    redisInstance.lpush("_errors", JSON.stringify({"key": redisKey, "sessionId": sessionId}), function(err, results){ redisInstance.quit() })
}
RedisWatchError.prototype = Object.create(Error.prototype)

var NonExistError = function(message, sessionId, appName, userId) {
    this.message = message;
    this.sessionId = sessionId;
    this.appName = appName;
    this.userId = userId;
    this.name = "NonExistError"
}
NonExistError.prototype = Object.create(Error.prototype)

var _log = function(){ if(cfg.verbose) console.log.apply(console, arguments)}
exports.module = {}
exports.module._log = _log

var _checkServerStatus = function(serversOnline){
    if(serversOnline == 2 && !online){
        redisSub._init(exports.module)
        wsServer.timeout = 0
        wsServer.listen(cfgNet.port)
    }
}

var _checkMaintanceMode = function(){
    return false
}

process.on('uncaughtException', function (err) { _log('Exception: ' + err) })

/**
 * Socket Server - on client connection to socket server
 * @param socket the user socket
 */
wsServer.on('connection', function(socket){

    //Set the configs for the socket
    socket.setNoDelay(true);
    socket.setKeepAlive(true, 300 * 1000);
    socket.isConnected = true;

    //API server trying to ping.
    if(socket.remoteAddress === "::ffff:000.000.000.000"){ //TODO: replace with a online check server ip
        socket.end("OK");
        socket.destroy();
        socket.unref();
        return
    }

    counter.inc();

    _log('==============================================================');
    _log('NEW NET SOCKET RESPONSE: ' + socket.remotePort);
    _log('==============================================================');
    _log('ADDRESS: '+ socket.remoteAddress + ':' + socket.remotePort);

    //Add this new connection to the list of clients
    var sessionId = new Buffer(socket.remoteAddress + ':' + socket.remotePort + ':' +(new Date().getUTCMilliseconds()), 'base64').toString('hex')
    socket.sessionId = sessionId
    _log('SESSION ID: '+ socket.sessionId);

    //Set socket state
    socket.state = "init"

    //Track buffer
    socket.buffer = new Buffer(cfgNet.buffer_size);  // due to Buffer's nature we have to keep track of buffer contents
    socket.buffer.len = 0;

    socket.on('data', function(dataRaw){

            //Ensure buffer sent to us is the right size to prevent ddos or hijacking
        if (dataRaw.length > (cfgNet.buffer_size - socket.buffer.len)) {
            _log("Data doesn't fit the buffer. Adjust the buffer size in configuration")
            socket.buffer.len = 0 // trimming buffer
            return false
        }

        //Keeping track of how much data we have in buffer
        socket.buffer.len +=  dataRaw.copy(socket.buffer, socket.buffer.len)

        var objJson, start, end, message, strMsg = socket.buffer.slice(0,socket.buffer.len).toString()

        if (dataRaw.indexOf("__STATUS__") !== -1) {
            let isMaint = _checkMaintanceMode()
            if(isMaint){
                socket.end("FAIL");
                socket.destroy();
                socket.unref();
                return
            } else {
                socket.write("OK");
            }
        }

        /********************************************************************************
         /* EVENT - INIT CONNECTION
         /********************************************************************************/
        if ((start = strMsg.indexOf("__INIT__")) !==  -1   &&   (end = strMsg.indexOf("__ENDINIT__"))  !==  -1) {

            //Is socket in the middle of an exit state? destroy socket if so
            if(socket.state === "exiting") { return _destroySocket(socket, 'ws init')}

            //Extract the json from the message string
            message = strMsg.substr(start+8, end-(start+8))
            objJson = JSON.parse(message)

            //Determine that this connecting client is the only one of it's username/appName
            if(objJson.intent && objJson.intent === "ssoCheck" && objJson.userId){
                redisSub._sendSsoCheck(objJson.appName, objJson.appName, objJson.userId)
            } else {

                //set session id to socket
                socket.sessionId = sessionId

                //Cut the messagesList from the last message extracted
                strMsg = strMsg.substr(end+15)
                socket.buffer.len = socket.buffer.write(strMsg, 0)

                //init socket vars and redis subscriber client.
                redisSub.initSocket(socket, objJson)

                //Set this socket in the list of active socket connections
                socketsList[sessionId] = socket

            }
/*            _log('==============================================================');
            _log('--END NEW NET SOCKET RESPONSE: ' +  socket.remotePort);
            _log('==============================================================');*/
        }

        //Put messageList in a do/while in case queued messages exist
        var timeToExit = true;
        do {
            if((start = strMsg.indexOf("__JSON__START__")) != -1 && (end = strMsg.indexOf("__JSON__END__")) != -1){

                //Extract the json from the message string
                message = strMsg.substr(start+15, end-(start+15))
                strMsg = strMsg.substr(end+13);
                socket.buffer.len = socket.buffer.write(strMsg, 0)
                objJson = JSON.parse(message)

                //Determine if client's redis connection to pub/sub server is active
                var redisClient = redisSub._getRedisClient(sessionId)

                //Is socket in the middle of an exit state? keep destroying socket if so
                if(socket.state === "exiting" || !redisClient) { return _destroySocket(socket, 'ws data') }

                if(!redisClient.ready){ redisSub._sendErrorMessage(socket, false, false, "Server unavailable", true) }

                //Figure out the intent
                var intent = (objJson && objJson.intent) ? objJson.intent : false;

                //Determine route based on intent (switch statement is better when more than 2 if/else)
                switch(intent){
                    case "subscribe":
                        redisSub.requestSubscribe(sessionId, objJson.roomName, objJson.params)
                        break;
                    case "unsubscribe":
                        redisSub.requestUnsubscribe(sessionId, objJson.roomName, objJson.params)
                        break;
                    case "disconnect":
                        return _destroySocket(socket, 'ws intent disconnect')
                    case "keepAlive":
                        redisSub._keepAlive(sessionId, objJson.params)
                        break;
                    case "sendChatToRoom":
                        redisSub._updateChatData(sessionId, objJson)
                        break;
                    case "syncSessionData":
                        redisSub._prepareSyncSessionData(sessionId, objJson)
                        break;
                    case "sendRoomEvent":
                        redisSub._prepareRoomEvent(sessionId, objJson)
                        break;
                    case "eventConfirm":
                        redisSub._onVerifiedResponse(objJson.eventId)
                        break;
                    default:
                        _log('====================================')
                        _log('--INCOMING REQUEST w/ no listener')
                        _log('====================================')
                        _log(objJson)
                        _log('====================================')
                        _log('--END INCOMING REQUEST w/ no listener')
                        _log('====================================')
                        break

                }
                timeToExit = false;
            } else { timeToExit = true; } // if no json data found in buffer - then it is time to exit this loop
        } while (!timeToExit);
    });

    socket.on('error', function(e){
        _destroySocket(socket, 'ws error');
    });

    socket.on('close', function(){
        counter.dec();
        _destroySocket(socket, 'ws close');
    });

    socket.on('timeout', function(){
        socket.state = "expired";
        _destroySocket(socket, 'ws timeout');
    });

    socket.on('drain', function(){
        if(socket.state && sessionId && (socket.state !== "exiting" || socket.state === "expired")){
            let subscriber = redisSub._getRedisClient(sessionId)
            if(!subscriber){
                _destroySocket(socket, 'ws drain no sub');
            }
        }
    });
});

wsServer.on('error', function(e){ console.log("Error on socket server" + e.message); });

var _getSocket = function(sessionId) {
    return socketsList[sessionId]
}

exports.module._getSocket = _getSocket;

let _isUpdatingConnections = false;
let _updateConnections = function(){
    if(_isUpdatingConnections) return true
    _isUpdatingConnections = true
    wsServer.getConnections(function(err,count){
        if(err){
            _log("Err::_getConnections: ",err)
        }
        if(count){
            let redisStore = pubsubServer.duplicate();
            return redisStore.zaddAsync("_node:connections", count, "_node:server:1")
            .then(function(res){
                return res
            }).finally(function(){
                redisStore.quit();
                _isUpdatingConnections = false;
            }).catch(function(e){
                _log('---------------------------------------------');
                _log('ERR: connection retrieval: _node:server:1');
                _log('---------------------------------------------');
                _log(e);
                _log('---------------------------------------------');
                _log('--END ERR: connection retrival: _node:server:1');
                _log('---------------------------------------------');
            });
        } else {
            _isUpdatingConnections = false;
        }
    })

}

/**
 * Socket Server - Destroy a connected users' connection to redis and socket
 * @param socket
 * @param functionName
 * @private
 */
var _destroySocket = function(socket, functionName) {
    if(!functionName){ functionName = "undefined"; }

    var sessionId = socket && socket.sessionId ? socket.sessionId : socket;

    if(typeof socket === "string"){
        _log('is string  '+ socket);
        socket = socketsList[socket]
    }

    if(typeof sessionId === "string"){
        let subscriber = redisSub._getRedisClient(sessionId)
        if(subscriber){

            _log('sub found, unsub and unref')
            subscriber.unsubscribe();
            return
        }
    }

    if(socket && socket.state){
        if(socket.state === "exiting") return;
        socket.state = "exiting"
    }

    //Set exiting to true
    if(socketsList[sessionId]){
        _log('IP: ' + socket.remoteAddress + ':' + socket.remotePort);
        socketsList[sessionId].isConnected = false
        socketsList[sessionId].destroy()
        socketsList[sessionId].buffer = null
        delete socketsList[sessionId].buffer
        delete socketsList[sessionId]
    } else if(typeof socket !== "string" && socket && !socket.destroyed && socket.destroy){
        socket.isConnected = false
        socket.destroy()
        socket.buffer = null
        delete socket.buffer
        socket.unref()
    }

    //Update number of connections on node, set the value inside redis
    _updateConnections();

    _log('==============================================================');
    _log('SERVER SOCKET: DESTROY SOCKET | ' + functionName);
    _log('Node Count: '+ wsServer._connections);
    _log('==============================================================');

/*    _log('==============================================================');
    _log('--END SERVER SOCKET: DESTROY SOCKET | '+ functionName);
    _log('Node Count: '+ wsServer._connections);
    _log('==============================================================');*/

};
exports.module._destroySocket = _destroySocket

var _onUserSubUnsub = function(type, sessionId, receivedRoom, isGameRoom){
    var isUnsubscribed = type == "unsubscribed" || type == "disconnected"
    var redisStore = pubsubServer.duplicate()
    var roomArr = receivedRoom.split(":")
    var appName = roomArr[0]
    var category = roomArr[1]
    var theme = roomArr[2]
    var isLobby = theme == "lobby"
    roomArr.pop();
    var roomPath = roomArr.join(":")

    var multi = redisStore.multi()

    if(!isUnsubscribed && isGameRoom){

        multi.hsetnx(receivedRoom + "|info", "roomPath", roomPath);
        multi.hsetnx(receivedRoom + "|info", "roomType", category + ":" + theme);
        multi.hsetnx(receivedRoom + "|info", "created", Date.now());
        multi.hset(receivedRoom + "|info", "updated", Date.now());
    } else {

    }

    return multi.execAsync()
        .then(function(){
            var multi = redisStore.multi();

            redisStore.watch(receivedRoom)

            if(isGameRoom){
                redisStore.watch(receivedRoom + "|info","gameRoom:"+sessionId)
            }

            if(isUnsubscribed){
                multi.srem(receivedRoom, sessionId);
            } else {
                multi.sadd(receivedRoom, sessionId);
            }
            multi.scard(receivedRoom);

            if(isGameRoom){
                multi.get("gameRoom:" +sessionId);
            }
            return multi.execAsync()
        }).then(function (results) {
            if (results === null) {
                throw new RedisWatchError(receivedRoom, sessionId, appName)
            }

            //On game room, modify the category
            if(isGameRoom){
                var newCount = results[1]
                var sessionDetails = results[2]

                redisStore.watch(receivedRoom, receivedRoom + "|info", "gameRoom:" + sessionId);
                var multi = redisStore.multi()
                if (roomPath) {

                    //Getting theme counts use this.
                    if(isUnsubscribed) {
                        multi.srem(roomPath, sessionId)
                    } else {
                        multi.sadd(roomPath, sessionId)
                    }

                    redisStore.watch("cat|"+roomPath)
                    if (newCount <= 0) {
                        multi.zrem("cat|" + roomPath, receivedRoom)
                        multi.del(receivedRoom + "|info")
                        multi.del("update|"+receivedRoom)
                    } else {
                        multi.zadd("cat|" + roomPath, newCount, receivedRoom)
                    }

                }

                if (sessionDetails && sessionDetails[0]) {
                    if (isUnsubscribed && sessionDetails[0] == receivedRoom) {
                        multi.del("gameRoom:" + sessionId);
                    } else {
                        multi.set("gameRoom:" + sessionId, receivedRoom);
                    }
                }
                return multi.execAsync()
            }

            return results;

        }).then(function(isRoomModified){
            if (isRoomModified === null) {
                throw new RedisWatchError(receivedRoom, sessionId)
            }
            return redisSub._onRoomUpdate(receivedRoom, !isLobby)
        }).finally(function(){
            redisStore.quit();
        }).catch(RedisWatchError, function(e){
            _log('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~');
            _log('ERR: KEY MODIFIED Sub/unsub | ROOM: ' + receivedRoom);
            _log(e)
            _log('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~');
        }).catch(NonExistError, function(e){
            _log('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~');
            _log('ERR: not found during sub/unsub ');
            _log(e.sessionId + "|" + e.appName + "|" + e.userId);
            _log('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~');
            if(e && e.sessionId){
                var subscriber = redisSub._getRedisClient(e.sessionId);
                if(subscriber){
                    subscriber.quit();
                }
            }
        }).catch(function(e){
            _log('---------------------------------------------');
            _log('ERR: PSUB Sub/unsub| ROOM: ' + receivedRoom);
            _log('---------------------------------------------');
            _log(e);
            _log('---------------------------------------------');
            _log('--END ERR: PSUB Sub/unsub | ROOM: ' + receivedRoom);
            _log('---------------------------------------------');
        });
}

var _onDisconnect = function(sessionId,receivedRoom, countWatcher){
    var sessionRoom = "cleanup:"+sessionId
    var redisStore, userId, appName, gameRoom, username;


    var subscriber = redisSub._getRedisClient(sessionId);
    if(subscriber){
        _log('sending to unsubscribe instead')
        subscriber.unsubscribe();
        subscriber.quit();
        return false
    }

    redisStore = countWatcher.duplicate();

    return redisStore.multi()
        .rename(receivedRoom, sessionRoom)
        .get("gameRoom:"+sessionId)
        .hmget(sessionRoom, "userId", "appName", "username")
        .execAsync()
        .spread(function (renameRoom, sessGameRoom, sessData) {
            gameRoom = renameRoom && sessGameRoom !== "" ? sessGameRoom : false;
            userId = sessData[0]  ? sessData[0] : false;
            appName = sessData[1] ? sessData[1] : false;
            username = sessData[2] ? sessData[2] : false;

            if(appName && userId ){

                var redisStore2 = redisStore.duplicate()
                redisStore2.sinterAsync("users:_online", "users:"+userId+":friends").then(function(friends){
                    var dataToSend = {
                        "phase": "playerOffline",
                        "response": {
                            "userId": userId,
                            "message": username + " is offline."
                        }
                    }
                    var redisMulti = redisStore2.multi()
                    for (var x = 0; x < friends.length; x++) {
                        var friendId = friends[x];
                        redisMulti.publish("users:"+friendId, JSON.stringify(dataToSend));
                    }
                    redisMulti.execAsync()

                }).finally(function(){
                    redisStore2.quit();
                })

                if(gameRoom){
                    return _onUserSubUnsub("unsubscribed", sessionId, gameRoom)
                }
                return true
            }
            throw new NonExistError('No appName or userId', sessionId, appName, userId)
        }).then(function(removedFromGameRoom){
            if(removedFromGameRoom === null) {
                throw new RedisWatchError(gameRoom, sessionId, removedFromGameRoom)
            }

            //Remove session stored var and from users list
            return redisStore.multi()
                .del("gameRoom:"+sessionId)
                .del(sessionRoom)
                .srem("sessions", sessionId)
                .srem("user:"+userId, receivedRoom)
                .scard("user:"+userId)
                .srem(receivedRoom+"|reserves", sessionId)
                .execAsync();
        }).then(function(removedSessionResults) {
            if (removedSessionResults === null) {
                throw new RedisWatchError(receivedRoom, sessionId, removedSessionResults)
            }
            if (removedSessionResults[4] > 0) {
                return true;
            }
            redisStore.watch("users:" + userId);
            return redisStore.multi()
                .del("users:" + userId)
                .srem("users:_online", userId)
                .hdel("users:" + appName, userId)
                .execAsync()
        }).then(function(removedResults){
            if (removedResults === null) {
                throw new RedisWatchError("users:" + userId, sessionId, removedResults);
            }

        }).finally(function() {

            redisStore.quit()

        }).catch(RedisWatchError, function(){
            _log('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~');
            _log('ERR Dis: KEY MODIFIED | ROOM: ' + receivedRoom);
            _log('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~');
        }).catch(NonExistError, function(e){
            _log("SocketNonExist: " + e.sessionId + "|" + e.appName + "|" + e.userId);
            if(e && e.sessionId){
                var subscriber = redisSub._getRedisClient(e.sessionId);
                if(subscriber){
                    subscriber.quit();
                }
                var sock = _getSocket(e.sessionId);
                if(sock && !sock.destroyed){
                    sock.destroy();
                }
            }
        }).catch(function(e){
            _log('---------------------------------------------');
            _log('ERR Dis: PSUB | ROOM: ' + receivedRoom);
            _log('---------------------------------------------');
            _log(e);
            _log('---------------------------------------------');
            _log('--END ERR Dis: PSUB | ROOM: ' + receivedRoom);
            _log('---------------------------------------------');
        });
}


pubsubServer.on('ready', function() {
    _log('pubsub server connect')
    exports.module._pubsubServer = pubsubServer;
    pubsubServer.client("setname", 'nodeServer');
    pubsubServer.client("kill", "type", "pubsub", "skipme", "yes");
    pubsubServer.config("set", "timeout", 0);
    pubsubServer.flushdb();
    pubsubServer.set("_nextId", 100)

    var countWatcher = pubsubServer.duplicate();
    countWatcher.client("setname", "countWatcher");
    countWatcher.config("set", "notify-keyspace-events", "KEA");

    countWatcher.psubscribe.apply(countWatcher, [
        "[^_]*:*:*:[0-9]*",
        "session:*",
        "__keyspace@0__:reserve|*|*",
        "__keyspace@0__:expire:*",
        "__keyspace@0__:update|*",
    ]);

    countWatcher.on("pmessage", function(pattern, receivedRoom, msg) {

        var sessionId, roomArr;

        //Send an update to the users in channel. basically a ping but with information.
        if(pattern == "__keyspace@0__:update|*" && msg == "expired"){
            roomArr = receivedRoom.toString().split('|');
            var gameRoomName = roomArr[1];
            return redisSub._onRoomUpdate(gameRoomName, true)
        }

        if(pattern == "__keyspace@0__:reserve|*|*"){
            roomArr = receivedRoom.toString().split('|');
            sessionId = roomArr[1];
            var roomName = roomArr[2];

            if(sessionId && (msg == "expired" || msg == "rename_from" ||msg == "del")){
                //var isExpired = msg == "expired"
                //var isConnected = msg == "rename_from"
                var redisStore = pubsubServer.duplicate();
                redisStore.watch(receivedRoom)

                var multi = redisStore.multi();
                multi.srem(roomName+"|reserves", sessionId);

                return multi.execAsync().then(function (results) {

                    if (results == null) {
                        throw new RedisWatchError(receivedRoom, sessionId, results)
                    }

                    return true
                }).finally(function(){
                    redisStore.quit();
                }).catch(RedisWatchError, function(e){
                    _log('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~');
                    _log('ERR: KEY MODIFIED reserve expire/rename | ROOM: ' + receivedRoom);
                    _log(e)
                    _log('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~');
                }).catch(function(e){
                    _log('---------------------------------------------');
                    _log('ERR: PSUB reserve expire/rename| ROOM: ' + receivedRoom);
                    _log('---------------------------------------------');
                    _log(e);
                    _log('---------------------------------------------');
                    _log('--END ERR: PSUB expire/rename | ROOM: ' + receivedRoom);
                    _log('---------------------------------------------');
                });
            }
            return
        }

        if(pattern == "__keyspace@0__:expire:*"){

            if(msg == "expired") {
                sessionId = receivedRoom.replace('__keyspace@0__:expire:', '');
                var instanceSocket = _getSocket(sessionId)
                if(instanceSocket){
                    instanceSocket.state = "expired"
                    _destroySocket(instanceSocket, 'ws timeout keyspace');
                } else {
                    _onDisconnect(sessionId, receivedRoom, countWatcher);
                }
            }
            return
        }
        if ((pattern != "[^_]*:*:*:[0-9]*" && pattern != "session:*") || !msg || !util._isJson(msg) || !JSON.parse(msg)) {
            return false
        }
        var event = JSON.parse(msg);
        var phase = event.phase;
        var response = event.response;

        if (phase == "disconnected") {
            sessionId = receivedRoom.replace('session:', '');
            _onDisconnect(sessionId, receivedRoom, countWatcher);

        } else if ((phase == "subscribed" || phase == "unsubscribed") && response.sessionId) {
            _onUserSubUnsub(phase, response.sessionId, receivedRoom, response.isGameRoom)
        }
    });
    countWatcher.on("error", function(err){
        _log('error yo');
    })

    serversConnected++;
    _checkServerStatus(serversConnected);
});

apiServer.on('ready', function() {
    exports.module._apiServer = apiServer;
    apiServer.client("setname", 'pubsubServer');
    serversConnected++;
    _checkServerStatus(serversConnected);
});

wsServer.on('listening', function(){
    online = true;
    console.log("Server Listening On Port: " + wsServer.address().port);
});

pubsubServer.on('error', _onNodeClose)
pubsubServer.on('end', _onNodeClose)
apiServer.on('error', _onNodeClose)
apiServer.on('end', _onNodeClose)

/**
 * When the server exits / shuts down
 * @private
 */
function _onNodeClose() {

    if(pubsubServer && pubsubServer.connected){
        pubsubServer.quit();
    }

    if(socketsList){
        for(var s in socketsList){

            var dataToSend = {
                "phase": "disconnected",
                "room": "Server",
                "message": "Server shutting down.",
                "response": {
                    "sessionId": s.sessionId ? s.sessionId : null,
                }
            };

            var message = JSON.stringify(dataToSend);
            socketsList[s].write("__JSON__START__" + message + "__JSON__END__");
        }
    }

    setTimeout(function(){
        process.exit(0);//Destroy all users' connections connected to the node
    }, 300);
}


process.stdin.resume();
