const readline 		= require('readline')
const debug         = require('debug')      //https://github.com/visionmedia/debug
const _log          = debug('util')
const util = {}

/* Utilty Functions */
util._isJson = function(str){
    try {
        JSON.parse(str);
    } catch (e) {
        return false;
    }
    return true;
};

/**
 * Convert an object to an array
 *
 * @param {object} obj
 * @return {array}
 * @example
 * ```js
 * > convertObjectToArray({ a: '1' })
 * ['a', '1']
 * ```
 */
util._convertObjectToArray = function (obj) {
    let result = [];
    for (let key in obj) {
        if (obj.hasOwnProperty(key)) {
            result.push(key, obj[key]);
        }
    }
    return result;
};

util._isEmptyObject = (obj) => {
	return !Object.keys(obj).length
}


/**
 * Convert a map to an array
 *
 * @param {Map} map
 * @return {array}
 * @example
 * ```js
 * > convertObjectToArray(new Map([[1, '2']]))
 * [1, '2']
 * ```
 */
util._convertMapToArray = function (map) {
    let result = [];
    let pos = 0;
    map.forEach(function (value, key) {
        result[pos] = key;
        result[pos + 1] = value;
        pos += 2;
    });
    return result;
};

util._arrToSet = (arr) => {
    if (!arr){ return null }

    let result = []
    let length = arr.length
    for (let i = 0; i < length; i+=2) {
        let item = arr[i]
        let next = arr[i+1]
        result.push([item, next])
    }
    return result
}


util._isObject = function(a){
    return (!!a) && (a.constructor === Object);
};

util._isArray = function(a){
    return (!!a) && (a.constructor === Array);
};

util._startsWith = function(str, word){
    return str.indexOf(word) === 0;
};
util._endsWith = function(str, suffix){
    return str.match(suffix+"$")==suffix
};

util._clone = function(o) {
    var ret = {};
    Object.keys(o).forEach(function (val) {
        ret[val] = o[val];
    });
    return ret;
};

util._flatten = (arr) => arr.reduce((a, b) => a.concat(b), [])

//utility to colon arguments put in
util._colon = (...args) => {
    return Array.from(args).join(':')
}

//utility to bar arguments put in
util._bar = (...args) => {
    return Array.from(args).join('|')
}

util._remapToObject = (arr) =>
    arr.reduce((result, item) => {
        result[item[1]] = item[0]
        return result
    }, {})


util._isNodeConnectionAlive = function(socket) {

    //Check if socket is okay
    return !(!socket || !socket.isConnected ||socket.destroyed || !socket.writable || !socket.buffer || !socket.buffer.write);
};

//TODO: put this somewhere else
const SYSTEM_ROOM_TYPE = -1
const STANDARD_ROOM_TYPE = 0
const REALTIME_ROOM_TYPE = 1
const TURNBASED_ROOM_TYPE = 2

util._isGameRoom = (id) => {
	switch(id){
		case REALTIME_ROOM_TYPE:
		case TURNBASED_ROOM_TYPE:
			return true
		default:
		case SYSTEM_ROOM_TYPE:
		case STANDARD_ROOM_TYPE:
			return false
	}
}

util._roomNameToArr = (roomName = "") => {
	let roomNameArr, roomPath, roomAppName, roomGame, roomTheme, roomId
	if(roomNameArr = roomName.match('^(\\w+):(\\w+):(\\w+):([0-9]+)$')){
		[roomName, roomAppName, roomGame, roomTheme, roomId] = roomNameArr
		roomPath = roomAppName+":"+roomGame+":"+roomTheme
	} else if(roomNameArr = roomName.match('^(\\w+):(\\w+):([a-zA-Z]+)$')){
		[roomPath, roomAppName, roomGame, roomTheme] = roomNameArr
	}

	return {
		//Main 2
		roomName: roomName,
		roomPath: roomPath,

		//Specific
		roomAppName: roomAppName,
		roomGame: roomGame,
		roomTheme: roomTheme,
		roomId: roomId,

		//other room names
		roomAppGameName: util._colon(roomAppName,roomGame),
		roomAppGameThemeName: util._colon(roomAppName,roomGame,roomTheme),
		roomGameThemeName: util._colon(roomGame,roomTheme),
	}
}

util.setLoadPercent = (p) =>{
	let text = `[Starting PID: ${process.pid}] .. ${p}%`
	process.stdout.write(text)
}

util.clearTerminal = () => {
	readline.clearScreenDown()
}

module.exports = util
