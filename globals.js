const cluster       = require('cluster')
const os            = require('os')
const config        = require('../../includes/env.json')[process.env.NODE_ENV || 'development']
const debug         = require('debug') //https://github.com/visionmedia/debug
const Promise       = require('bluebird') //https://github.com/visionmedia/debug
const helpers       = require('./utils/helpers') //https://github.com/visionmedia/debug
const _log          = debug('globals')
const sockets = {}

'use strict'
const isNumeric = (n) => !isNaN(parseFloat(n)) && isFinite(n)

let globals = Object.assign({
    clientSocketsList: [],
    sockets: sockets,
    isMaintenanceMode: false,
    //universal functions
    getVariable: (keyName) => {
    	const value = globals[keyName]
		if(value && isNumeric(value)){
			return parseFloat(value)
		}
		return value
	},
    setVariable: (keyName, value) => globals[keyName] = value,
    removeVariable: (keyName, index) => {
        globals[keyName][index] = null
        delete globals[keyName][index]
    },
    pushVariable: (keyName, value) => globals[keyName].push(value),
},config) //attaches config to the tail end of the globals table


sockets.getSockets = () => globals.clientSocketsList //shortcut for getVariable("clientSocketsList")

sockets.addSocket = (socket) => {
	const index = globals.clientSocketsList.push(socket)
	_log('adding index %s | %s', index, socket.sessionId)
	_log('now socket list is', globals.clientSocketsList.length)

	return index
}
sockets.getSocketBySessionId = (searchVal) => globals.clientSocketsList.find((element, index, array) => element.sessionId === searchVal)
sockets.getIndexBySessionId = (searchVal) => globals.clientSocketsList.findIndex((element, index, array) => element.sessionId === searchVal)

//pass in array, get an array of sockets
sockets.getSocketsBySessionIds = (searchVal) => globals.clientSocketsList.filter((element) => searchVal.indexOf(element.sessionId) !== -1)

sockets.writeToSessionId = (sessionId, message) => {
    return Promise.fromCallback((callback) => {
        const socket = sockets.getSocketBySessionId(sessionId) //search for socket if it is on this server
        if(!socket) return callback(null, 'not found')
        socket.resume()
        return socket.write(message, null, callback)
    }).then((socketWrote) => {
        return socketWrote
    }).catch((err) => {
        return [sessionId, message]
    })
}

sockets.writeToSocket = (socket, message, attempts) => {
    return Promise.fromCallback((callback) => {
        return socket.write(message, null, callback)
    }).then((socketWrote) => {
        return socketWrote
    }).catch((err) => {
        if(attempts && attempts > 5){
            _log('attempts max', err.toString())
            return false
        } else {
            attempts = attempts ? attempts++ : 1
            return sockets.writeToSocket(socket,message,attempts++)
        }
    })
}

sockets.writeToAllSockets = (message) => {
    return Promise.resolve(globals.clientSocketsList).map((socket) =>{
        return sockets.writeToSocket(socket, message)
    }).then((result) => result)

}

sockets.deleteSocketBySessionId = (searchVal) => {
    let index = sockets.getIndexBySessionId(searchVal)
    if(index > -1){
        _log('deleting index %s | %s', index, searchVal)
        globals.clientSocketsList.splice(index, 1)

		_log('now socket list is', globals.clientSocketsList.length)
		return true
    }
    return false
}

sockets.setSocketState = (socket, state) => {
    if(typeof socket === "string"){
        let index = sockets.getIndexBySessionId(socket)
        socket = index ? globals.clientSocketsList[index] : false
    }
    if(!socket) return false

    socket.state = state
    return socket.state
}

module.exports = globals
