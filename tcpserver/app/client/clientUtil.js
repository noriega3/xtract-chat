const debug         = require('debug')      //https://github.com/visionmedia/debug
const _log          = debug('clientUtil')
const _error        = debug('clientUtil:err')


const _isEqual		= require('lodash/isEqual')
const _isBuffer		= require('lodash/isBuffer')
const _includes		= require('lodash/includes')
const _get			= require('lodash/get')
const _has			= require('lodash/has')

const _isJson = require('../util/isJson')

console.log('new instance of client Util')
const store			= require('../store')

const addConfig = {
	attempts: 3,
	timeout: 5000,
	backoff: 1000,
	removeOnComplete: false,
}

module.exports = {
	_handleSocketError: (identifier, socket, error) => {
		store.clients.removeClientById(identifier)
		return socket.destroy(error)
	},

	_handleSocketClose: (identifier, socket, hasError) => {
		const sessionQueue  = store.queues.getQueueByName('sessionQueue')

		_log('[Close Socket]: %s', identifier)
		store.clients.removeClientById(identifier)
		if(socket.end) socket.end()
		if(socket.destroy) socket.destroy()
		socket.unref()
		return sessionQueue.add('destroy', {sessionId: identifier}, addConfig)
	},

	_handleSocketTimeout: (socket, identifier) => {
		//TODO: redis set flag that user expired, set a timer from here to allow them one more turn on turn based or x seconds
		socket.end()
	},
	_handleSocketData: (identifier, socket, rawData) => {

		let data = _isBuffer(rawData) ? _handleBuffer(socket, rawData) : rawData

		if(_includes(data, '__ENDCONNECTION__')) {
			socket.end()
			return true
		}

		if(_includes(data, '__INIT__') && _includes(data, '__ENDINIT__'))
			return _handleInit(identifier, socket, data)

		if(_includes(data, '__JSON__START__') && _includes(data, '__JSON__END__'))
			return _handleJson(identifier, socket, data)

		if(_includes(data, '__STATUS__'))
			_handleStatus(identifier, socket, data)

		return true
	}
}

const _validateJwt = (message) => {

	return true
}


const _handleBuffer = (socket, data) => {
	_log('[Socket] is a buffer true | converted \n', data.toString())
	return data.toString()
}

const _convertStrInitToObject = (data) => {
	const initStart = data.lastIndexOf('__INIT__')
	const initEnd = data.lastIndexOf('__ENDINIT__')
	if(initStart !== -1 && initEnd !== -1) {
		const str = data.slice(initStart + 8, initEnd)
		return _isJson(str) ? JSON.parse(str) : {}
	}
	console.log('something is wrong', initStart, initEnd)
	return false
}

const _handleInit = (identifier, socket, data) => {
	const {jwt, clientTime, ...json} = _convertStrInitToObject(data)
	const RequestEventQueue = store.queues.getQueueByName('requestQueue')
    const isValidated = _validateJwt(jwt) //validate jwt before handling data
	if(!isValidated) return false

	RequestEventQueue.add({
			queue:'sessionQueue',
			intent:'init',
    	    jobData:{
                req: jwt,
                sessionId: identifier,
	            timeAddQueue: Date.now(),
                clientTime,
                params: _get(json, 'params', json)
			}
		}, addConfig)
		//.tap(_log)
		.tapCatch(_error)

    return true
}

const _convertStrJsonToObject = (data) => {
	//Unlike init, we start from beginning of str
	const jsonStart = data.indexOf('__JSON__START__')
	const jsonEnd = data.indexOf('__JSON__END__')

	if(jsonStart !== -1 && jsonEnd !== -1) {
		const str = data.slice(jsonStart + 15, jsonEnd)
		return _isJson(str) ? JSON.parse(str) : {}
	}
	return false
}

const _handleJson = (identifier, socket, data) => {
	const RequestEventQueue = store.queues.getQueueByName('requestQueue')
	const {jwt, ...json} = _convertStrJsonToObject(data)
    const isValidated = _validateJwt(jwt) //validate jwt before handling data
	_log('is validated', isValidated)
    if(!isValidated) return false
	const sessionId = identifier
    if(!json) return _error('invalid json received')

	console.log('json handle', json, '\n session', sessionId)

	const _handleIntent = (intent, json) => {
		const room = _get(json, 'roomName', _get(json, 'room')) //fix differs of room and roomName into one inline if (lodash)
		let jobData = {sessionId, room, req: jwt, params: _get(json, 'params', data)}
		let queue

		//Determine route based on intent
		switch (intent) {
			//session queue, uses params
			case "confirmInit":
			case "keepAlive":
			case "ssoCheck": //SSO = single sign-off logic
			case "ssoLogout": //SSO = single sign-off logic				//todo: not integrated yet
				queue = 'sessionQueue'
				break
			//room queue, uses params
			case "subscribe":
			case "unsubscribe":
			case "sendChatToRoom": //TODO: restructure sendChatToRoom to follow the {intent, params} format and possibly split to another socket connection?
			case "syncSessionData":
			case "sendRoomEvent": //whoever sends will need to verify when the server sends back an eventId
			case "confirmRoomEvent":
			case "eventConfirm":
			case "sendMatchEvent":
				queue = 'roomQueue'
			break
			case "disconnect":
				console.log('disconnect has been requested')
				if(_has(socket, 'close')) socket.close()
				if(_has(socket, 'end')) socket.end()
				return
		}

		RequestEventQueue.add({queue,intent,jobData}, addConfig)
			.call('finished')
/*			.tap((result) => {
				//TODO: use this when confirming submission of this session's intents (all others will go through redismessagebridge
				_log('result', result)
			})*/
	}

	if(_has(json, 'intent'))
		_handleIntent(json.intent, json)
    return true
}

const _handleStatus = (identifier, socket, data) => {
	const offline = false
	if(_isEqual(offline, true)){
		socket.close(-1)
	} else {
		socket.send("OK")
	}
}
/*
const helpers = {
	removeInitsFromBuffer: (socket) => {
		//remove any outstanding inits
		const initStart = socket.buffer.indexOf("__INIT__")
		const initEnd = socket.buffer.indexOf('__ENDINIT__')
		let sliced

		if(initStart !== -1 && initEnd !== -1){
			//remove the init from the buffer
			sliced = socket.buffer.slice(initStart,initEnd+11)
			sliced.fill(0)
			socket.bufferLen -= (initStart+initEnd+11)
			return helpers.removeInitsFromBuffer(socket)
		}
		return socket
	},
	setupInit: (socket) => {
		//ensure we are getting the last init of the buffer in case of multiple init calls
		const initStart = socket.buffer.lastIndexOf('__INIT__')
		const initEnd = socket.buffer.lastIndexOf('__ENDINIT__')

		if(initStart !== -1 && initEnd !== -1){

			//Ensure that multiple requests for init won't reinit the user (var is unset inside init queue)
			if(socket.state === "confirming" && socket.initMessage) return Sockets.writeToSocket(socket, socket.initMessage)
			if(socket.state === "ready" && socket.initMessage) {
				socket.state = "error"
				return false
			}
			socket.state = "connecting"

			const initStart = socket.buffer.lastIndexOf('__INIT__')
			const initEnd = socket.buffer.lastIndexOf('__ENDINIT__')
			const bufStr        = socket.buffer.toString('utf8',initStart+8,initEnd)
			const playerData    = bufStr && helper._isJson(bufStr) ? JSON.parse(bufStr) : {}

			sessionQueue
				.add('init',{ sessionId: socket.sessionId, playerData, timeAddQueue: Date.now() }, {...addConfig, removeOnComplete: false})
				.then((nestedJob) => nestedJob.finished())
				.then((message) => {
					socket.state = "confirming"
					socket.initMessage = message
				})
				.catch((err) => {
					_error('disconnecting due to error', err.messsage)
				})
		}
		helpers.removeInitsFromBuffer(socket)
	},
	disconnectSocket: (sessionId) => {
		_log("[Alert]: disconnecting socket by request")
		return Sockets.closeSocket(sessionId, 0, "CLOSED")
	},
	checkServerStatus: (socket) => {
		if(globals.getVariable("isMaintenanceMode")){
			Sockets.closeSocket(socket, -1, "FAIL")
			Sockets.deleteSocketBySessionId(socket.sessionId)
		} else {
			const initEnd = socket.buffer.lastIndexOf('__STATUS__')
			let sliced = socket.buffer.slice(initEnd+11)
			sliced.fill(0)
			socket.bufferLen -= initEnd+10
			if(!socket.isWebSocket)	socket.resume()
			Sockets.writeToSocket(socket, "OK")
			if(socket.bufferLen > 0){
				_log('[Data Finish]', socket.bufferLen)
				_log('[Data Finish B]', socket.buffer)
			}
		}
		return true
	}
}

const handleBuffer = (socket, buffer) => {
	//ensure that the data received is not over the unallocated size of the buffer
	if(buffer.length > (maxBufferSize - socket.bufferLen)){
		_log("[Alert]: the data received is larger than what the buffer size allows")
		socket.bufferLen = 0
		return false
	}

	//append this data received to the client's buffer, and set the new length
	socket.bufferLen += buffer.copy(socket.buffer, socket.bufferLen)
	//the size is predefined, so any slices will cut the available amount to use.
	socket.buffer = socket.buffer.slice(0, maxBufferSize)

	return socket.buffer
}

const handleClientIntent = ({intent, data}, socket) => {

}

const checkDataJson = (socket, data) => {
	let jsonStart = data.indexOf('__JSON__START__')
	let jsonEnd = data.indexOf('__JSON__END__')
}
const handleDataJson = (socket, data) => {
	if(socket.state === "error") return helpers.disconnectSocket(socket.sessionId)

	//Unlike init, we start from beginning of buffer
	let jsonStart = data.indexOf('__JSON__START__')
	let jsonEnd = data.indexOf('__JSON__END__')

	if(jsonStart !== -1 && jsonEnd !== -1) {

		let bufStr = buf.toString('utf8', jsonStart + 15, jsonEnd)
		let data = bufStr && helper._isJson(bufStr) ? JSON.parse(bufStr) : {}
		let intent = (data && data.intent) ? data.intent : false
		const isSocketReady = socket.state === 'ready'
		_log('[Request]', data)
		_log('[Socket State]', socket.state)

		handleClientIntent({intent, data}, socket)

		//take out the json, and rerun the function to ensure we have executed all the json in the buffer
		let sliced = socket.buffer.slice(jsonStart, jsonEnd + 13)
		sliced.fill(0)
		socket.bufferLen -= (jsonStart + jsonEnd + 13)
		_log('[Data after parse]', intent, socket.bufferLen)
		return handleDataJson(newData)
	}
	return newData
}
const onSocketData = (socket, dataRaw) => {
	let data = dataRaw

	if(_isBuffer(dataRaw)) {
		data = handleBuffer(socket, dataRaw)
	}

	//socket.pause()

	_log('on socket buffer', data)
	_log('on socket raw', dataRaw)
	_log('on socket data str', dataRaw.toString())
	_log('on socket current buffer len', socket.bufferLen)
	_log('is socket a websocket?', socket.isWebSocket)

	//TODO: implement backpressure on users that spam

	//Ensure user did not send an __ENDCONNECTION__ flag in this buffer
	const toEndConnection = data.includes("__ENDCONNECTION__")
	if(toEndConnection) return onSocketClose(socket.sessionId)

	//Check if this client is just checking the status
	if (data.includes("__STATUS__")) return helpers.checkServerStatus(socket)
	if (globals.getVariable("isMaintenanceMode")) return onSocketClose(socket.sessionId)

	//Init or resume client based on values send in
	helpers.setupInit(socket) //NOTE: this make take time, so other requests before will be "lost"
	if(socket.state === "error") return helpers.disconnectSocket(socket.sessionId)

	handleDataJson(socket, data)	//Extract the json string from buffer
	//clear the socket's stream buffer for lua (so it doesn't block)
	//socket.isWebSocket ? socket.send('OK') : socket.write('OK')

	//Only alert us when we have a buffer
	if(socket.bufferLen > 0){
		_log('[Data Finish]', socket.bufferLen)
		_log('[Data Finish B]', socket.buffer.toString())
	}
}

const onSocketError = (socket, sessionId) => {

	//TODO: redis ensure redis instance is valid before settings timers
	//TODO: redis set expiration on client to 10 - turn based
	//TODO: redis set expiration on client to 30 - non-turn based
}

const onSocketClose = (socket, sessionId) => {

	sessionQueue.add('destroy', {sessionId: sessionId}, {...addConfig})

	setImmediate(() => {
		_log('[Closed Socket]: %s', sessionId)
		Sockets.terminateSocket(sessionId)
		Sockets.deleteSocketBySessionId(sessionId)
	})
}

const onSocketTimeout = (socket, sessionId) => {

	//TODO: redis set flag that user expired, set a timer from here to allow them one more turn on turn based or x seconds
}

//Use factory functions for performance (over classes and regular functions) (server side,
/!*
	In JavaScript, classes are more verbose & restrictive than factories, and a bit of a minefield when it comes to refactoring, but they’ve also been embraced by major front-end frameworks like React and Angular, and there are a couple of rare use-cases that make the complexity worthwhile.
 *!/
//https://medium.com/humans-create-software/factory-functions-in-javascript-video-d38e49802555
//http://thenodeway.io/posts/designing-factories/
//https://medium.com/javascript-scene/javascript-factory-functions-with-es6-4d224591a8b1

//pure functions: https://medium.com/javascript-scene/master-the-javascript-interview-what-is-a-pure-function-d1c076bec976
//A pure function produces no side effects, which means that it can’t alter any external state.

//differences: https://medium.com/javascript-scene/javascript-factory-functions-vs-constructor-functions-vs-classes-2f22ceddf33e
//https://medium.com/javascript-scene/3-different-kinds-of-prototypal-inheritance-es6-edition-32d777fa16c9

/!* ============================================================================================================================================================================= *!/

const createNodeSocket = ({
	//defaults
	sessionId = "invalid",
	_identifier = "client",
} = {}) => ({

})*/

/**
 * (note#1) - Reasoning on "too fast" node actions (https://www.bennadel.com/blog/3236-using-transform-streams-to-manage-backpressure-for-asynchronous-tasks-in-node-js.htm)
 * .on("data") will put the readable stream into "flowing" mode, which means that it will start emitting data events as fast as they can be produced by the underlying source.
 * Unfortunately, if you're trying to take that data and insert it into a Redis database, for instance, the "data" handler has no way of telling the upstream source to pause while the Redis operation is executing.
 * As such, you can quickly overwhelm your Redis connection pool and command queue as well as consume an inappropriately large amount of process memory.
 * Solution: using bull queue to manage queues coming in. seems to work so far.
 */
