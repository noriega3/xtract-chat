NODE_ENV            = "development";
var exports         = module.exports = {}
var bluebird        = require("bluebird")
var cfg             = require("../includes/config.js")
var util            = require('../util.js')
var Promise         = bluebird
var _redisClients   = []
var apiServer, pubsubServer, _destroySocket, _getSocket
var RedisError, RedisWatchError

RedisError = function(message) { this.message = message; this.name = "RedisError";};
RedisError.prototype = Object.create(Error.prototype);
var parent;

var _checkClientSub = function(redisConnection){
    return redisConnection && redisConnection.connected && redisConnection.closing != true/* && (checkSubMode && redisConnection.pub_sub_mode == 1)*/
}

var _log = function(){
    if(cfg.verbose) console.log.apply(console, arguments);
};
exports._checkClientSub = _checkClientSub
exports._init = function(functs){
    parent          = functs
    pubsubServer    = parent._pubsubServer
    apiServer       = parent._apiServer
    _destroySocket  = parent._destroySocket
    _getSocket      = parent._getSocket

    RedisWatchError = function(redisKey, sessionId) {
        this.name = "RedisWatchError";
        var redisInstance = pubsubServer.duplicate();
        redisInstance.lpush("_errors", JSON.stringify({"key": redisKey, "sessionId": sessionId}), function(err, results){
            redisInstance.quit()
        });
    };
    RedisWatchError.prototype = Object.create(Error.prototype);
};

/**
 * Prepares the socket, adds a redis client to the socket and subscribes to initial (non game rooms)
 * @param socket
 * @param params
 * @returns {*}
 */
exports.initSocket = function(socket, params){

    //Check if socket is okay
    if(!util._isNodeConnectionAlive(socket)){
        _sendErrorMessage(socket, "init", false, "Connection failure.");
        return false;
    }

    //Check if valid information being passed
    if(socket.state == "exiting"){
        _sendErrorMessage(socket, "init", false, "A previous session was detected. Disconnecting from previous session.");
        return;
    }

    var sessionId = socket.sessionId;

    socket.state        = "init";
    socket.appName      = params.appName;
    socket.userId       = params.userId;
    socket.gameRoom     = false;
    socket.rooms        = [];
    socket.roomOptions  = [];

    var appName = socket.appName;
    var userId  = socket.userId;

    var subInstance = pubsubServer.duplicate({
        socket_keepalive: true,
        retry_strategy: function (options) {

            if (socket.state == "exiting") {
                _destroySocket(sessionId, 'initSocket');
                return new Error('User has exited the game');
            }

            socket.state = "reconnecting";

            if (options.error === 'ECONNREFUSED') {
                // End reconnecting on a specific error and flush all commands with a individual error
                _sendErrorMessage(sessionId, "refused", false, "Server is currently undergoing maintenance. Please try again later.");
                return new Error('The server refused the connection');
            }
            if (options.total_retry_time > 1000 * 60 * 60) {
                // End reconnecting after a specific timeout and flush all commands with a individual error
                _sendErrorMessage(sessionId, "reconnection", false, "Timed out connecting to server");
                return new Error('Retry time exhausted');
            }
            if (options.times_connected > 5) {
                // End reconnecting with built in error
                _sendErrorMessage(sessionId, "unstable", false, "Connection to the server is unstable. Progress may not be saved!!");
            }

            if (options.times_connected > 10) {
                _sendErrorMessage(sessionId, "reconnection", false, "Disconnected due to too many reconnects to server.");
                return new Error('times reconnected exceeded');
            }

            //reconnect after 10 times
            return Math.min(options.attempt * 100, 3000);
        }
    });


    subInstance.on("ready", function(){

        subInstance.client('setname', appName+":"+sessionId);

        //Send single sign on
        _sendSsoCheck(appName, userId, sessionId);

        var roomNames = [ "users:"+userId, appName+":"+userId, "session:"+sessionId, appName];
        subInstance.subscribe.apply(subInstance, roomNames);
    });

    subInstance.on("subscribe", function (receivedRoom, subCount) { _onSubscribe(sessionId, receivedRoom, subCount, params); });
    subInstance.on("message", function (receivedRoom, message) { _onMessage(sessionId, receivedRoom, message, params); });
    subInstance.on("unsubscribe", function(receivedRoom, subCount){ _onUnsubscribe(sessionId, receivedRoom, subCount, params); });
    subInstance.on("reconnecting", function(message){ _onReconnect(sessionId, message, params) });
    subInstance.on("error",function(error){ _sendErrorMessage(sessionId, "error"); });
    subInstance.on("end", function(){ _onEnd(socket.state, sessionId); });

    _redisClients[sessionId]  = subInstance

    return subInstance;
};

exports._keepAlive = function(sessionId, params){

    var socket = _getSocket(sessionId)
    var subscriber = exports._getRedisClient(sessionId)

    //Check if socket is okay
    if(!subscriber || !util._isNodeConnectionAlive(socket)){
        _sendErrorMessage(socket, "keepAlive", "session:"+sessionId, "Connection failure...");
        return false;
    }

    //Check if the redis subscriber is alive and well
    if(!exports._checkClientSub(subscriber)){
        _sendErrorMessage(sessionId, "unsubscribe", "session:"+sessionId, "No valid client was detected!", true);
        return false;
    }
    var redisStore = subscriber.duplicate()
    redisStore.watch("expire:"+sessionId);

    var dataToSend = {
        "phase": "pong",
        "response": params
    };

    var multi = redisStore.multi()

    multi.ping()
    multi.expire("expire:" + sessionId, 60) //session expiration after initial sub

    return multi.execAsync().then(function(results){
        if(results){
            _sendMessageToClient(sessionId, dataToSend)
        }

    }).finally(function(){
        redisStore.quit();
    }).catch(function(e){
        _log('---------------------------------------------');
        _log('ERR: keepAlive | SESSION: '+ sessionId);
        _log('---------------------------------------------');
        _log(e);
        _log('---------------------------------------------');
        _log('--END ERR: keepAlive | SESSION: '+ sessionId);
        _log('---------------------------------------------');
    });
};

/**
 * Requests a subscription from a room
 * @param sessionId
 * @param roomName
 * @param params
 * @returns {boolean}
 */
exports.requestSubscribe = function(sessionId, roomName, params){

    var socket = _getSocket(sessionId)
    var subscriber = exports._getRedisClient(sessionId)

    //Check if socket is alive and well
    if(!subscriber || !util._isNodeConnectionAlive(socket)){
        _sendErrorMessage(socket, "joinRoom", roomName, "Connection failure...");
        return false;
    }

    //Check if we are currently disconnecting from the game
    if(socket.state == "exiting"){
        _sendErrorMessage(socket, "joinRoom", roomName, "A previous session was detected. Disconnecting from previous session.");
        return;
    }

    //Check if params, roomName and userId are valid
    if(!params || !roomName || !socket.userId){
        _sendErrorMessage(socket, "joinRoom", roomName, "Invalid data was received.");
        return;
    }

    //Set state to connecting
    socket.state = "connecting";

    //Sign out any other users on this account under this app
    _sendSsoCheck(socket.appName, socket.userId, sessionId);

    //Check if game room type
    if(params.isGameRoom){
        socket.roomOptions[roomName] = params; //store properties to gather after subscribe
        var redisStore = subscriber.duplicate();

        //Check if reservation exists for user (this was created by the api)
        redisStore.existsAsync("reserve|"+sessionId+"|"+roomName).then(function(result){
            if(result){

                //Set pending game room to this room
                socket.pendingGameRoom = roomName;

                //Check if user is currently in a game room
                if(socket.gameRoom) {

                    //Set a pendingLeaveGameRoom to make sure we unsubscribe to the right room
                    socket.pendingLeaveGameRoom = socket.gameRoom;

                    //Send a request to unsubscribe from said room.
                    exports.requestUnsubscribe(sessionId, socket.pendingLeaveGameRoom);

                } else {

                    //No game room the user is currently in, so join room from redis client
                    subscriber.subscribe(roomName);
                }
                return;
            }

            //If no reservation is found, send an error
            _sendErrorMessage(socket, "reserveRoom", roomName, "Reservation not found", false);

        }).finally(function(){
            redisStore.quit();
        }).catch(function(e){
            _log('---------------------------------------------');
            _log('ERR: REQUEST SUBSCRIBE | ROOM: ' + roomName);
            _log('---------------------------------------------');
            _log(e);
            _log('---------------------------------------------');
            _log('--END ERR: REQUEST SUBSCRIBE | ROOM: ' + roomName);
            _log('---------------------------------------------');
        });

    } else {

        //Is not a game room type, so join room from redis client
        subscriber.subscribe(roomName);
        socket.roomOptions[roomName] = params; //store properties to gather after subscribe
    }
};

/**
 * Request an unsubscribe
 * @param sessionId
 * @param roomName
 * @param params
 * @returns {boolean}
 */
exports.requestUnsubscribe = function(sessionId, roomName, params){
    var socket = _getSocket(sessionId)
    var subscriber = exports._getRedisClient(sessionId)

    //Check if socket is alive and well
    if(subscriber && subscriber.connected && !util._isNodeConnectionAlive(socket)) {
        _sendErrorMessage(sessionId, "unsubscribe", roomName, "Connection failure....");
        return false;
    }

    //Check if the redis subscriber is alive and well
    if(!exports._checkClientSub(subscriber)){
        _sendErrorMessage(sessionId, "unsubscribe", roomName, "No valid client was detected!", true);
        return false;
    }

    //Check if we are in an expired state / user has expired out of room
    if(params){
        if(params.isExpired){
            socket.state = "expired";
        } else if(params.pendingRoom) {
            socket.pendingLeaveGameRoom = roomName
            socket.pendingGameRoom = params.pendingRoom.roomName,
            socket.roomOptions[socket.pendingGameRoom] = params.pendingRoom.options;
        }
    }

    //Send a unsubscribe from room to the redis client
    subscriber.unsubscribe(roomName);


};

/**
 * Sends a message w/ unique sessionId to ensure user is the only one connected
 * @param appName
 * @param userId
 * @param sessionId
 * @returns {boolean}
 * @private
 */
var _sendSsoCheck = function(appName, userId, sessionId){

    if(!pubsubServer || !sessionId || !appName || !userId){
        return false;
    }

    var dataToSend = {
        "phase": "ssoCheck",
        "room": appName+":"+userId,
        "response": sessionId
    };
    pubsubServer.publish(appName+":"+userId, JSON.stringify(dataToSend));
};
exports._sendSsoCheck = _sendSsoCheck;

/**
 * Checks if the sessionId received matches with the socket's sessionId
 * @param sessionId
 * @param message
 * @returns {boolean}
 * @private
 */
var _checkSso = function(sessionId, message){

    try{
        var messageObj = message;

        if(util._isJson(messageObj)) {
            messageObj = JSON.parse(messageObj);
        }

        var isCheck = messageObj.phase == "ssoCheck";
        var receivedSession = messageObj.response;

        //Check if sessionId doesn't match. Then send logout.
        if(isCheck && receivedSession != sessionId){
            var dataToSend = {
                "phase": "ssoLogout",
                "response": {
                    "sessionId": sessionId,
                    "newSessionId": messageObj.response
                }
            };
            //Send message directly to client
            _sendMessageToClient(sessionId, dataToSend, function(){
                var subscriber = exports._getRedisClient(sessionId)
                return subscriber ? subscriber.unsubscribe() : false
            });
        }
    } catch (exception){

        console.log("Exception on checking sso");
        console.log(exception);

        return false;
    }
};

/***
 * Retrieves the list of players in the room
 * @param roomName
 * @returns {*}
 * @private
 */
exports._getSubscribersListDetailed = function(roomName) {
    var redisStore = pubsubServer.duplicate();

    var roomArr = roomName.split(":");
    var multi = redisStore.multi();

    var results = {}

    return redisStore.smembersAsync(roomName)
        .then(function (members) {
            if (!members) {
                return [];
            }
            var playersFound = false;
            for (var x = 0; x < members.length; x++) {
                multi.hgetall("session:"+members[x]);
                playersFound = true;
            }

            return playersFound ? multi.execAsync() : [];
        }).then(function (playersData) {

            redisStore.quit();

            return playersData ? playersData : [];
        }).map(function(playersData){
            if(!playersData){
                return [];
            }
            return playersData;
        }).then(function(mapped){
            results = {"key": "players", "data": mapped};

            return results
        }).finally(function(){
            redisStore.quit();

            return results;
        }).catch(function(e){
            _log('---------------------------------------------');
            _log('ERR: _getSubscribersListDetailed | ROOM: ' + roomName);
            _log('---------------------------------------------');
            _log(e);
            _log('---------------------------------------------');
            _log('--END ERR: _getSubscribersListDetailed | ROOM: ' + roomName);
            _log('---------------------------------------------');
        });
};

/***
 * Retrieves the players counts from theme rooms based on gameType
 * @param roomName
 * @returns {*}
 */
exports._getGameThemeCounts = function (roomName) {
    var typeArr = roomName.split(":")
    var appName = typeArr[0]
    var gameType = typeArr[1]
    var redisStore = pubsubServer.duplicate()


    return redisStore.multi().pubsub("channels", appName + ":" + gameType + ":*:*[^a-z]").execAsync()
        .then(function (results) {
            if (!results || !results[0] || results[0].length <= 0) {
                return [];
            }
            return redisStore.multi().pubsub("numsub", results[0]).execAsync();

        }).then(function (results) {

            //Check if room list is empty
            if (!results || !results[0]){ return {};}

            var formattedList = {};
            for (var x = 0; x < (results[0].length); x += 2) {
                var roomArr = results[0][x].split(":");
                var themeName = roomArr[2];

                if(themeName) {
                    if (formattedList[themeName]) {
                        formattedList[themeName] += results[0][x + 1]
                    } else {
                        formattedList[themeName] = results[0][x + 1]
                    }
                }
            }
            results = {"key": "counts", "data": formattedList};
            return results

        }).finally(function(results){
            redisStore.quit();
            return results
        }).catch(function(e){
            _log('---------------------------------------------');
            _log('ERR: _getGameThemeCounts');
            _log('---------------------------------------------');
            _log(e);
            _log('---------------------------------------------');
            _log('--END ERR: _getGameThemeCounts');
            _log('---------------------------------------------');
        });
};
/*
var _getSubscribersList = function(roomName) {
    var roomArr = roomName.split(":");
    var appName = roomArr[0];
    var redisStore = pubsubServer.duplicate();
    var multi = api.multi();
    var results = {}
    return redisStore.smembersAsync(roomName)
        .then(function(members){
            if (!members) {
                return [];
            }
            var playersFound = false;
            for (var x = 1; x < members.length; x++) {
                multi.hmget(members[x], "sessions:"+appName);
                playersFound = true;
            }
            return playersFound ? multi.execAsync() : [];
        }).then(function(playersData){

            redisStore.quit();

            return playersData ? playersData : [];
        }).map(function(playersData){
            if(!playersData){
                return [];
            }
            results = playersData
        }).finally(function(){
            redisStore.quit();
            return results;
        }).catch(function(e){
            _log('---------------------------------------------');
            _log('ERR: _getSubscribersListDetailed');
            _log('---------------------------------------------');
            _log(e);
            _log('---------------------------------------------');
            _log('--END ERR: _getSubscribersListDetailed');
            _log('---------------------------------------------');
        });
};*/

/***
 * On redis client end, this is triggered
 * @param state
 * @param sessionId
 * @private
 */
var _onEnd = function(state, sessionId){
/*    _log('---------------------------------------------');
    _log('EVENT: SOCKET SUB ONEND');
    _log('---------------------------------------------');*/

    _redisClients[sessionId] = null;
    delete _redisClients[sessionId];

    var dataToSend = {
        "phase": "disconnected",
        "response" : {
            "sessionId": sessionId,
            "isExiting": state === "exiting",
            "isExpired": state === "expired"
        }
    };
    _log('Socket End Start: ',sessionId)
    _sendMessageToRoom("session:"+sessionId, dataToSend);
    _sendMessageToClient(sessionId, dataToSend, "onSubEnd");
};

/***
 * On reconnection of redis client, this is triggered
 * @param sessionId
 * @param message
 * @returns {boolean}
 * @private
 */
var _onReconnect = function(sessionId, message){
    var socket = _getSocket(sessionId)

/*    _log('---------------------------------------------');
    _log('EVENT: SOCKET SUB RECONNECT');
    _log('---------------------------------------------');*/

    if(!socket || !socket.state){
        if(sessionId){
            _destroySocket(sessionId, 'onReconnect');
        }
        return false;
    }

    if(socket.appName && socket.userId && socket.sessionId){
        //Send single sign on
        _sendSsoCheck(socket.appName, socket.userId, socket.sessionId);
    }

    //socket.intendedRoom = socket.room;

    if(socket.state == "exiting"){ _log("User is Exiting while server is reconnecting"); return false; }

    if(socket._connecting === true){
        _destroySocket(sessionId, 'onReconnect');
    }
    _log('---------------------------------------------');
    _log('--END EVENT: SOCKET SUB RECONNECT');
    _log('---------------------------------------------');
};

/***
 * When a user receives a message from a .publish and they match the room
 * @param sessionId
 * @param roomName
 * @param message
 * @returns {boolean}
 * @private
 */
var _onMessage = function(sessionId, roomName, message){
/*    _log('---------------------------------------------');
    _log('EVENT: SOCKET SUB MESSAGE | ' + roomName);
    _log('---------------------------------------------');*/
    var socket = _getSocket(sessionId)
    var subscriber
    //_log("Message: "+message);

    //Check if there is even a socket..
    if(!socket){
        //_log("session is "+sessionId)
        //_log("room is "+roomName)
        //retrieve zombie session
        subscriber = exports._getRedisClient(sessionId)
        //unsub and unref if found
        if(subscriber){
            _destroySocket(sessionId, 'onMessage')
            return false;
        }
    }

    //Check the message and ensure it is JSON, and the room name isn't the session subscription.
    if(util._isNodeConnectionAlive(socket) && message && util._isJson(message) && roomName != "session:"+sessionId){
        socket.write("__JSON__START__" + message + "__JSON__END__");1
        socket.buffer.len = socket.buffer.write(message, 0);
    }

    //If the client sends out an expire or exiting, it wants to disconnect or client is exiting from app.
    if(message == "expired" || message == "exiting"){
        subscriber = exports._getRedisClient(sessionId)
        if(util._isNodeConnectionAlive(socket)){ socket.state = message; }
        if(subscriber){
            subscriber.unsubscribe();
        }
    }

    //When a client receives the sso check and fails, its sends a logout to the client.
    if(util._isNodeConnectionAlive(socket) && socket.appName && socket.userId && sessionId){
        var isSSORoom = roomName == socket.appName+":"+socket.userId;
        if(isSSORoom && !_checkSso(sessionId, message)){ return false; }
    }



/*    _log('---------------------------------------------');
    _log('--END EVENT: SOCKET SUB MESSAGE | ' + roomName);
    _log('---------------------------------------------');*/
};

/***
 * Sets the timer for the next room update.
 * @param roomName
 * @returns {*}
 * @private
 */
var _setNextUpdate = function(roomName){
    var redisStore = pubsubServer.duplicate()
    return redisStore.setexAsync("update|"+roomName, 10, Date.now() + 5000)
        .finally(function(){
            redisStore.quit();
        })
        .catch(function(e){
            _log('---------------------------------------------');
            _log('ERR: Set next update | ROOM: ' + roomName);
            _log('---------------------------------------------');
            _log(e);
            _log('---------------------------------------------');
            _log('--END ERR: Set next update | ROOM: ' + roomName);
            _log('---------------------------------------------');
        })
}
var validGames = ["slots", "poker", "blackjack"]
/***
 * On a room update, the entire room gets a list of the latest data according to the config of the room
 * This is also known as what happens when a server tick occurs.
 * @param roomName
 * @param autoUpdate
 * @returns {*}
 * @private
 */
var _onRoomUpdate = function(roomName, autoUpdate){
    var redisStore = pubsubServer.duplicate()
    var typeArr = roomName.split(":")
    var category = typeArr[1]
    var themeOrLobby = typeArr[2]
    var roomType = category+":"+themeOrLobby
    var isLobby = themeOrLobby == "lobby"
    var isGameRoom = validGames.indexOf(category) > -1
    var roomExists = false
    var queue = []

    return redisStore.multi()
        .exists(roomName) //check if exists
        .select(1) //select db 1
        .hmget("gameRoom:onUpdate", roomType, category+":*") //roomType, default
        .select(0)
        .execAsync()
    .then(function(results) {
        if (!results[0] || !results[2]) {
            return []
        } else {
            roomExists = true
            //return first if room type is found, else return the default
            var jsonFunctNames = results[2][0] ? results[2][0] : results[2][1]
            return JSON.parse(jsonFunctNames)
        }
    }).then(function(functNames){
        if(functNames){
            for (var x = 0; x < functNames.length; x++) {
                var functName = functNames[x];
                if (exports[functName]) {
                    queue.push(exports[functName](roomName))
                }
            }
        }
    }).then(function(){

        if(!roomExists) return

        return Promise.all(queue).then(function(results) {
            var response = {}
            for (var x = 0; x < results.length; x++) {
                response[results[x]["key"]] = results[x]["data"]
            }

            var dataToSend = {
                "phase": "roomUpdate",
                "response": response
            };
            _sendMessageToRoom(roomName, dataToSend);

            if(!isLobby && autoUpdate && isGameRoom){
                _setNextUpdate(roomName);
            }

        })

    }).finally(function(){
        redisStore.quit();
    }).catch(function(e){
        _log('---------------------------------------------');
        _log('ERR: roomupdate| ROOM: ' + roomName);
        _log('---------------------------------------------');
        _log(e);
        _log('---------------------------------------------');
        _log('--END ERR: roomupdate| ROOM: ' + roomName);
        _log('---------------------------------------------');
    })

}
exports._onRoomUpdate = _onRoomUpdate

/***
 * On a successful subscription of a room
 * @param sessionId
 * @param roomName
 * @param numSubs
 * @param params
 * @returns {boolean}
 * @private
 */
var _onSubscribe = function(sessionId, roomName, numSubs, params){

    var socket = _getSocket(sessionId)
    var subscriber = exports._getRedisClient(sessionId)

    //Check if socket is alive and well
    if (!subscriber || !util._isNodeConnectionAlive(socket)) {
        _sendErrorMessage(sessionId, "joinRoom", roomName, "Connection failure.....");
        return false
    }

    //Check if client is exiting
    if (socket.state == "exiting") {
        return false
    }

    var userId  = socket.userId
    var appName = socket.appName

    var username    = params.username
    var score       = params.score
    var avatar      = params.avatar

    socket.rooms[roomName] = true;

    if (socket.pendingGameRoom == roomName) {
        socket.gameRoom = roomName;
        socket.pendingGameRoom = null;
    }

    var isReconnected = socket.state == "reconnecting" && true || false;
    var requestParams = socket.roomOptions[roomName] || [];
    var sceneName = requestParams.sceneName;
    var isGameRoom = socket.gameRoom == roomName;
    var roomPath

    var publish = subscriber.duplicate()
    var multi = publish.multi()
    var gotoSubAgain = false

    Promise.all([]).then(function() {
/*        _log('---------------------------------------------');
        _log('--EVENT: SOCKET SUB SUBSCRIBE');
        _log('ROOM: ' + roomName + " | USER SUBS: " + numSubs);
        _log('---------------------------------------------');*/

        if (isGameRoom) {
            roomPath = roomName.toString().split(":")
            roomPath.pop()
            roomPath = roomPath.join(":")

            publish.watch(roomName, "gameRoom:" + sessionId, "reserve|" + sessionId + "|" + roomName);
            multi.ping(new Date().toString())
            multi.sadd("sessions", sessionId)
            multi.hmset("session:" + sessionId, "username", username)
            multi.persist("reserve|" + sessionId + "|" + roomName)
            multi.rename("reserve|" + sessionId + "|" + roomName, "gameRoom:" + sessionId)
        }

        if (socket.state == "init" && numSubs == 4) {

            multi.setex("expire:" + sessionId, 60, userId) //session expiration
            multi.sadd("users:_online", userId) //app specific
            multi.hset("users:" + appName, userId, "session:" + sessionId) //app specific
            multi.sadd("user:" + userId, "session:" + sessionId) //all apps same user
            multi.hmset("session:" + sessionId, "appName", appName, "sessionId", sessionId, "userId", userId, "username", username, "score", score, "avatar", avatar)
        }

        return multi.execAsync()

    }).then(function(multiResult) {

        if (!multiResult) {
            gotoSubAgain = true
            _log('going to onsub again')
            return false
        }

        var dataToSend = {
            "phase": "subscribed",
            "response": {
                "isReconnected": isReconnected,
                "sceneName": sceneName,
                "isGameRoom": isGameRoom,
                "roomPath": roomPath,
                "sessionId": sessionId,
                "userId": userId
            }
        };
        _sendMessageToRoom(roomName, dataToSend);

        if (socket.state == "init" && numSubs == 4) {
            dataToSend = {
                "phase": "init",
                "response": {
                    "sessionId": socket.sessionId,
                    "userId": userId,
                    "rooms": socket.rooms
                }
            };
            _sendMessageToClient(sessionId, dataToSend);

            socket.state = "connected"

            //Add notification for friends list
            return publish.multi()
                .exists("users:" + userId + ":friends")
                .sinter("users:_online", "users:" + userId + ":friends")
                .execAsync()


        }
    }).then(function(results){
        if(!results || !results[0] || !results[1]){ return }
        var friends = results[1]
        var dataToSend = {
            "phase": "playerOnline",
            "response": {
                "userId": userId,
                "message": username + " is online."
            }
        }
        for (var x = 0; x < friends.length; x++) {
            var friendId = friends[x];
            _sendMessageToRoom("users:"+friendId, dataToSend);
        }



    }).finally(function(){
        if(publish && publish.connected){ publish.quit(); }

        if(gotoSubAgain){
            _onSubscribe(sessionId, roomName, numSubs)
        }

        _log("Subscribe: "+ sessionId + " | Room: " + roomName);
/*        _log('---------------------------------------------');
        _log('--END EVENT: SOCKET SUB SUBSCRIBE');
        _log('ROOM: ' + roomName + " | USER SUBS: " + numSubs);
        _log('---------------------------------------------');*/

    }).catch(RedisWatchError, function(){
        _log('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~');
        _log('ERR onSub: KEY MODIFIED | ROOM: ' + roomName + "| USER SUBS: "+ numSubs);
        _log('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~');
    }).catch(function(error){
        _log('---------------------------------------------');
        _log('ERR: SOCKET SUB SUBSCRIBE');
        _log('ROOM: '+ roomName + " | USER SUBS: "+ numSubs);
        _log('---------------------------------------------');

        _log('error');
        _log(error)

        _log('---------------------------------------------');
        _log('--END ERR: SOCKET SUB SUBSCRIBE');
        _log('ROOM: '+ roomName + " | USER SUBS: "+ numSubs);
        _log('---------------------------------------------');
    });

};

/**
 * On a successful uunsubscribe from a room.
 * @private
 * @param sessionId
 * @param roomName
 * @param subCount
 */
var _onUnsubscribe = function(sessionId, roomName, subCount){
    Promise.all([]).then(function(){

        var socket      = _getSocket(sessionId)
        var userId      = socket && socket.userId ? socket.userId : "N/A"
        var isGameRoom  = socket && socket.gameRoom && socket.gameRoom == roomName ? socket.gameRoom : false;
        var isExpired   = socket && socket.state == "expired"
        var isPendingRoom  = socket && socket.pendingGameRoom

/*
        _log('---------------------------------------------');
        _log('EVENT: SOCKET SUB UNSUBSCRIBE');
        _log('ROOM: '+ roomName + " | USER SUBS: "+ subCount);
        _log('---------------------------------------------');
*/

        var dataToSend = {
            "phase": "unsubscribed",
            "room": roomName,
            "response": {
                "isGameRoom": isGameRoom,
                "sessionId": sessionId,
                "userId": userId,
                "isExpired": isExpired,
                "isPendingRoom":  isPendingRoom,
            }
        };

        _sendMessageToRoom(roomName, dataToSend);
        _sendMessageToClient(sessionId, dataToSend);

        if(sessionId){
            var subscriber = exports._getRedisClient(sessionId)

            //Remove the current room from the options list of socket
            if(socket && subscriber){
                socket.roomOptions[roomName] = null;
                delete socket.roomOptions[roomName];
            }

            //Check if socket subscriptions is 0, it should never be 0
            if(subCount === 0){
                if(subscriber){
                    subscriber.quit();
                    return
                }
            }

            //Check if this room was pending to be left
            if(socket && socket.pendingLeaveGameRoom == roomName){

                //Remove this room from the pending variable.
                socket.pendingLeaveGameRoom = null;
                delete socket.pendingLeaveGameRoom;

                //Check if there's a pending game room to join
                if(socket.pendingGameRoom){

                    //Send a subscribe to room to the redis client
                    subscriber.subscribe(socket.pendingGameRoom);
                }
            }
        }
        _log("Unsubscribe: "+ sessionId+ " | Room: "+roomName)
        /*

        _log('---------------------------------------------');
        _log('--END EVENT: SOCKET SUB UNSUBSCRIBE');
        _log('ROOM: '+ roomName + " | USER SUBS: "+ subCount);
        _log('---------------------------------------------');
*/


    }).catch(function(e){
        _log('---------------------------------------------');
        _log('ERR: SOCKET SUB UNSUBSCRIBE');
        _log('ROOM: '+ roomName + " | USER SUBS: "+ subCount);
        _log('---------------------------------------------');

        _log(e);

        _sendErrorMessage(sessionId, "onLeaveRoom",roomName, e.message);

        _log('---------------------------------------------');
        _log('--END ERR: SOCKET SUB UNSUBSCRIBE');
        _log('ROOM: '+ roomName + " | USER SUBS: "+ subCount);
        _log('---------------------------------------------');

    });
};

/**
 * Sends a message to everyone in the room
 * @param roomName
 * @param message
 * @returns {boolean}
 * @private
 */
var _sendMessageToRoom = function(roomName, message){

    var dataToSend = message;
    var redisStore = pubsubServer.duplicate();

    try{

        if(util._isJson(message)){
            dataToSend = JSON.parse(message);
            dataToSend.room = roomName;
            dataToSend.response.room = roomName;
            dataToSend = JSON.stringify(dataToSend);
        } else if(util._isObject(message)){
            dataToSend.room = roomName;
            dataToSend.response.room = roomName;
            dataToSend = JSON.stringify(dataToSend);
        }

        var resultSuccess = false;
        return redisStore.multi()
                .select(3)
                .lpush("logs:"+roomName, dataToSend)
                .ltrim("logs:"+roomName, 0, 99) // trim to last 100 messages
                .expire("logs:"+roomName, 86400)
                .select(0)
                .publish(roomName, dataToSend)
                .execAsync()
            .then(function(replies){
                if(replies != null){
                    resultSuccess = replies
                }
            }).finally(function(){
                redisStore.quit();
                return resultSuccess;
            });
    } catch (exception){

        if(redisStore.connected){
            redisStore.quit();
        }

        _log("Exception on sending message" + exception);

        return false;
    }
};
exports._sendMessageToRoom = _sendMessageToRoom;

/**
 * Sends a message to socket only
 * @param sessionId
 * @param message
 * @param onComplete
 * @returns {boolean}
 * @private
 */
var _sendMessageToClient = function(sessionId, message, onComplete){

    try{

        var socket = _getSocket(sessionId)
        //Check if socket is okay
        if(!socket|| !util._isNodeConnectionAlive(socket)){
            _destroySocket(sessionId, 'sendMessageToClient');
            return false;
        }

        if(util._isObject(message)){
            message = JSON.stringify(message);
        }

        if(util._isJson(message)){

            socket.write("__JSON__START__" + message + "__JSON__END__");
            socket.buffer.len = _getSocket(sessionId).buffer.write(message, 0);

            if(onComplete){
                if(typeof onComplete === "function"){
                    onComplete();
                } else {
                    _destroySocket(socket, (typeof onComplete === "string") ? onComplete : 'sendMessageToClient');
                }
            }
        }

    } catch (exception){

        _log('exception on client')
        _log("Exception on sending message" + exception);

        return false;
    }
};

/**
 * Sends an error message to the room/user with the message
 * @param sessionId
 * @param phase area where error occurred
 * @param message friendly message to send
 * @param room
 * @param skipDisconnect skip the disconnect cycle
 * @returns {boolean}
 * @private
 */
var _sendErrorMessage = function(sessionId, phase, room, message, skipDisconnect){

    _log("********************************************");
    _log("EVENT: ERROR");
    _log("********************************************");

    var socketInstance = _getSocket(sessionId)

    if(!socketInstance){ _log('No Socket Associated with sessionId')}

    var dataToSend = {
        "error": true,
        "phase": phase,
        "room": room,
        "message": message
    };

    //_log("STATE: " + socketInstance && socketInstance.state !== undefined && socketInstance.state ? socketInstance.state : "N/A");
    _log("ERROR: " + message);
    _log("isDisconnecting: " + (skipDisconnect || true));

    _log("********************************************");
    _log("END EVENT: ERROR");
    _log("********************************************");

    _sendMessageToClient(sessionId, dataToSend, !skipDisconnect);
};
exports._sendErrorMessage = _sendErrorMessage;


exports._getRedisClient = function(sessionId){
    if(_redisClients[sessionId] && _checkClientSub(_redisClients[sessionId])){
        return _redisClients[sessionId]
    }
    return false
}

//ROOM EVENTS
var pendingEvents = []


//room type events
var _onGroupWin = function(sessionId, params){
    if(!sessionId || !params || !params.totalAmountWon || !params.betAmount || typeof(params.totalAmountWon) != "number" || typeof(params.betAmount) != "number"){ return false; }


    var socket = _getSocket(sessionId)
    var subscriber = exports._getRedisClient(sessionId)

    //Check if socket is okay
    if(!subscriber || !util._isNodeConnectionAlive(socket)){
        _sendErrorMessage(socket, "groupWin", "session:"+sessionId, "Connection failure...");
        return false;
    }

    //Check if the redis subscriber is alive and well
    if(!exports._checkClientSub(subscriber)){
        _sendErrorMessage(sessionId, "groupWin", "session:"+sessionId, "No valid client was detected!", true);
        return false;
    }
    var redisStore = subscriber.duplicate()
    var total = params.totalAmountWon * params.betAmount
    var totalAmountWon = Math.floor((total * .25) / 25) * 25
    var minPayout = 25
    var maxPayout = 50000

    return redisStore.multi()
        .select(1) //select db 1
        .hmget("gameRoom:serverVars", "groupWin:minPayout", "groupWin:maxPayout") //roomType, default
        .select(0)
        .execAsync()
        .then(function(results) {
            if (results[0] && results[1] && results[1][0] && results[1][1] && parseInt(results[1][0]) && parseInt(results[1][1])) {
                minPayout = parseInt(results[1][0])
                maxPayout = parseInt(results[1][1])
            }

            totalAmountWon = totalAmountWon < minPayout ? minPayout : totalAmountWon
            totalAmountWon = totalAmountWon > maxPayout ? maxPayout : totalAmountWon

            return {
                "event": "groupWin",
                "bonusScore": Math.round(totalAmountWon),
                "details": {
                    "totalAmountWon": params.totalAmountWon,
                    "betAmount": params.betAmount,
                    "minPayout": minPayout,
                    "maxPayout": maxPayout,
                }
            }

        }).finally(function(){
            redisStore.quit();
        }).catch(function(e){
            _log('---------------------------------------------');
            _log('ERR: groupWin|');
            _log('---------------------------------------------');
            _log(e);
            _log('---------------------------------------------');
            _log('--END ERR: groupWin| sess: ');
            _log('---------------------------------------------');

            totalAmountWon = totalAmountWon < minPayout ? minPayout : totalAmountWon
            totalAmountWon = totalAmountWon > maxPayout ? maxPayout : totalAmountWon

            return {
                "event": "groupWin",
                "bonusScore": Math.round(totalAmountWon),
                "details": {
                    "totalAmountWon": params.totalAmountWon,
                    "betAmount": params.betAmount,
                    "minPayout": minPayout,
                    "maxPayout": maxPayout,
                }
            }
        });
}

/**
 *
 * @param sessionId
 * @param eventData
 * @private
 */
exports._prepareRoomEvent = function(sessionId, eventData){

    try {

        if (!eventData || !eventData.eventId || !eventData.params || !eventData.params.event || !eventData.params.event.toString() || !eventData.room) {
            return false;
        }

        //EventName: param name, type
        var validEvents = {
            "groupWin": _onGroupWin
        }

        var socket = _getSocket(sessionId)
        var subscriber = exports._getRedisClient(sessionId)

        //Check if socket is okay
        if (!subscriber || !util._isNodeConnectionAlive(socket)) {
            _sendErrorMessage(socket, "roomEvent", "session:" + sessionId, "Connection failure!...")
            return false
        }

        var roomEventName = eventData.params.event
        var roomEventParams = eventData.params.data

        //Check if valid event
        if (typeof validEvents[roomEventName] === 'undefined') {
            return false
        }

        //Execute the room event's valid function and store in var  (note: it must be in bluebird promises format)
        var eventResponse = validEvents[roomEventName](sessionId, roomEventParams).then(function(responseData){
            return responseData
        })

        return eventResponse.then(function(eventResponse){

            if(!eventResponse) return false

            var eventId = eventData.eventId
            var dataResponse = {
                "phase": "receiveRoomEvent",
                "response": eventResponse
            };

            dataResponse.response.userId = socket.userId;
            dataResponse.response.sessionId = sessionId;

            pendingEvents[eventId] = ["_sendMessageToRoom", eventData.room, dataResponse]

            _sendMessageToClient(sessionId, {
                "phase": "sendRoomEvent",
                "room": eventData.room,
                "response": {
                    "userId": socket.userId,
                    "sessionId": sessionId,
                    "eventId": eventId,
                    "event": roomEventName
                }
            })
        })

    } catch (exception){

        _log("Exception at preparing room event" + exception);

        return false;
    }};

exports._onVerifiedResponse = function(eventId){

    if(pendingEvents[eventId]){
        var eventParams = pendingEvents[eventId]
        exports[eventParams[0]](eventParams[1], eventParams[2], eventParams[3])
        eventParams[eventId] = null
        delete eventParams[eventId]
    }
};

exports._prepareSyncSessionData = function(sessionId, eventData){
    if(!eventData || !eventData.eventId || !eventData.params || !eventData.params.auth){ return false; }

    var socket = _getSocket(sessionId)
    var subscriber = exports._getRedisClient(sessionId)

    //Check if socket is okay
    if(!subscriber || !util._isNodeConnectionAlive(socket)){
        _sendErrorMessage(socket, "syncSessionData", "session:"+sessionId, "Connection failure!...")
        return false
    }

    var validateAuth = function(auth, userId, appName){

        if(!auth || !userId || !appName){ return false }

        //TODO:use the new pubsub auth variable inside users:userId:auth and remove reliance on usersServer
        var apiStore = subscriber.duplicate()
        var isAuthEqual = false
        return apiStore.hgetAsync("users:"+userId+":auth", appName).then(function(result){
            if(result){
                var serverAuth = result
                isAuthEqual = serverAuth === auth
            }
            return isAuthEqual

        }).finally(function(){
            apiStore.quit()
            return isAuthEqual
        }).catch(function(e) {
            _log('---------------------------------------------');
            _log('ERR: VALIDATE AUTH');
            _log('auth: ' + auth);
            _log('---------------------------------------------');
            _log(e);
            _log('---------------------------------------------');
            _log('--END ERR: VALIDATE AUTH');
            _log('auth: ' + auth);
            _log('---------------------------------------------');
        });
    }

    var validateString = function(item){
        return item && typeof(item) == "string"
    }
    var validateNumber = function(item, min, max){
        if(!item || typeof(item) != "number"){ return false }
        if(min && item < min){ return false }
        if(max && item > max){ return false }
        return true
    }

    var eventId = eventData.eventId
    var params = eventData.params

    var validates = []

    validates.push(validateAuth(params.auth, params.userId, params.appName))
    validates.push(validateString(params.username))
    validates.push(validateNumber(params.score, 0))
    validates.push(validateNumber(params.level, 1))
    validates.push(validateNumber(params.subCurrency, 0))
    validates.push(validateString(params.avatar))

    Promise.all(validates).then(function(results){

        var allTrue = results.every(function(ele){ return ele === true })

        if(allTrue){

            pendingEvents[eventId] = ["_syncSessionData", sessionId, eventData]
            _sendMessageToClient(sessionId, {
                "phase": "syncSessionDataResponse",
                "response": {
                    "eventId": eventId,
                }
            })
        } else {
            _sendMessageToClient(sessionId, {
                "phase": "syncSessionDataResponse",
                "response": false
            })
        }
    }).catch(function(e){
        _log('---------------------------------------------')
        _log('ERR: validateSessionData')
        _log('SESSION: '+ sessionId)
        _log('---------------------------------------------')

        _log(e);

        _sendMessageToClient(sessionId, {
            "phase": "syncSessionDataResponse",
            "response": false
        })

        _log('---------------------------------------------')
        _log('--END ERR: validateSessionData')
        _log('SESSION: '+ sessionId)
        _log('---------------------------------------------')

    });
}

exports._syncSessionData = function(sessionId, eventData){

    if(!eventData || !eventData.eventId || !eventData.params || !eventData.params.auth){ return false; }

    var socket = _getSocket(sessionId)
    var subscriber = exports._getRedisClient(sessionId)

    //Check if socket is okay
    if(!subscriber || !util._isNodeConnectionAlive(socket)){
        _sendErrorMessage(socket, "syncSessionData", "session:"+sessionId, "Connection failure!...")
        return false
    }

    var params = eventData.params
    var redisStore = subscriber.duplicate()
    var username = params.username
    var score = params.score
    var avatar = params.avatar
    var forceRoomUpdate = params.forceRoomUpdate

    return redisStore.hmsetAsync(
        "session:" + sessionId,
        "username", username,
        "score", score,
        "avatar", avatar)
    .then(function(result) {
        if (!result) {
            return false
        }

        if (forceRoomUpdate && socket.gameRoom) {
            _onRoomUpdate(socket.gameRoom)
        }
    }).finally(function(){
        if(redisStore){ redisStore.quit() }
    }).catch(function(e) {
        _log('---------------------------------------------')
        _log('ERR: syncSessionDataConfirm')
        _log('sessionId: ' + sessionId)
        _log('---------------------------------------------')
        _log(e)
        _log('---------------------------------------------')
        _log('--END ERR: syncSessionDataConfirm')
        _log('sessionId: ' + sessionId)
        _log('---------------------------------------------')
    });
}

/**
 * Saves the chat message to the redisStore and sends the message to others in the room
 * @param sessionId
 * @param params
 * @returns {boolean}
 * @private
 */
exports._updateChatData = function(sessionId, params){

/*    _log('---------------------------------------------');
    _log('NEW CHAT MSG: SESSION ID: '+ sessionId +' ROOM: ' + params.room);
    _log('---------------------------------------------');*/

    var roomName = params.room;
    var message = params.message;
    var eventId = params.eventId;

    if(!roomName || !message || !eventId){
        return _sendMessageToClient(sessionId, {
            "phase": "sendChatToRoom",
            "response": {
                "eventId": eventId ? eventId : 'null',
                "error": "Invalid Data Received"
            }
        });
    }

    var socket = _getSocket(sessionId)
    var subscriber = exports._getRedisClient(sessionId)

    //Check if socket is okay
    if(!subscriber || !util._isNodeConnectionAlive(socket)){
        _sendErrorMessage(socket, "updateChat", "session:"+sessionId, "Connection failure!...")
        return false
    }

    //Check if the redis subscriber is alive and well
    if(!exports._checkClientSub(subscriber)){
        _sendErrorMessage(sessionId, "unsubscribe", "session:"+sessionId, "No valid client was detected!", true);
        return false;
    }

    var redisStore = subscriber.duplicate();

    return redisStore.multi()
        .hmget("session:"+sessionId, 'username', 'userId')
        .expire(roomName+":chatlog", 300)
        .execAsync().spread(function(userData){
            redisStore.quit();
            if(userData){
                var username = userData[0];
                var userId = userData[1];

                var dataToSend = {
                    "phase" : "sendChatToRoom",
                    "response" :  {
                        "timestamp": new Date().getTime().toString(),
                        "username": username,
                        "sessionId": sessionId,
                        "userId": userId,
                        "message": message,
                        "eventId": eventId
                    }

                };
                return _sendMessageToRoom(roomName, dataToSend);

            } else {
                _sendMessageToClient(sessionId, {
                    "phase": "sendChatToRoom",
                    "response": {
                        "eventId": eventId,
                        "error": "Invalid Data Received"
                    }
                });
            }

            /*_log('---------------------------------------------');
            _log('--END NEW CHAT MSG: SESSION ID: '+ sessionId +' ROOM: ' + roomName);
            _log('---------------------------------------------');*/
        }).catch(function(e) {
            _log('---------------------------------------------');
            _log('ERR: CHAT');
            _log('ROOM: ' + roomName);
            _log('---------------------------------------------');

            _log(e);

            _log('---------------------------------------------');
            _log('--END ERR: CHAT');
            _log('ROOM: ' + roomName);
            _log('---------------------------------------------');
        });
};