const cluster       = require('cluster')
const fs            = require('fs')
const Promise       = require("bluebird");
const debug         = require('debug') //https://github.com/visionmedia/debug
const globals       = require('../globals')
const Sockets       = globals.sockets
const helper       	= require('../utils/helpers')
const redisManager  = require('../scripts/redis_manager')
const roomActions   = require('../scripts/room/shared')
const client        = redisManager.client
const sessionQueue  = redisManager.sessionQueue
const roomSubQueue	= redisManager.roomSubQueue
const roomUpdateQueue	= redisManager.roomUpdateQueue
const roomQueue		= redisManager.roomQueue
const botsQueue				= redisManager.botsQueue			//handles all bot add events

const _log 		= debug("sessionQ"+ (cluster.isWorker ? ":"+cluster.worker.id : ""))
const _error 	= debug("error"+ (cluster.isWorker ? ":"+cluster.worker.id : ""))

const addConfig = {
    attempts: 3,
    removeOnComplete: true,
	timeout: 10000,
	backoff: {
    	type: 'fixed',
		delay: 500
	}
}
sessionQueue.setMaxListeners(0)

const _getTime = () => {
    return new Date().getUTCMilliseconds()
}

const _validatePlayerData = (data) => {
    return data
}

const _validateSessionId = (sessionId) => {
    if(typeof sessionId !== "string"){ throw new Error('blah') }
    return sessionId
}

sessionQueue.process('init',(job) => {

    const data          = job.data
    const sessionId     = _validateSessionId(data.sessionId)
    const socket        = Sockets.getSocketBySessionId(sessionId)
    const playerData    = _validatePlayerData(data.playerData)
    const appName       = playerData.appName
    const userId        = playerData.userId
    Sockets.setSocketState(socket, "connecting")

    //Redis key name shortcuts
    const sessionRoom = helper._colon('sessions', sessionId)

    //adds playerData to the new object to be set in session:*id*
    let sessionData = Object.assign({ sessionId:sessionId, online: true, created: _getTime() }, playerData)
    let objSessionData = helper._convertObjectToArray(sessionData)
    let roomList

    return client.initSession(sessionId, Date.now(), objSessionData)
        .then((rooms) => {
            roomList = helper._arrToSet(rooms)
            return roomSubQueue.add('subscribe', {
                sessionId: sessionId,
                rooms: roomList,
                userId: userId,
                appName: appName,
            }, addConfig)

		})
		.then((nestedJob) => nestedJob.finished())
		.then((nestedJobResults) => {
    	_log('nested Job Results', nestedJobResults)
            let rooms = helper._remapToObject(roomList)
			//return client.publishToRoom(sessionRoom, Date.now(), JSON.stringify(dataToSend))
            return roomSubQueue.add('publish', {
				message: {
					phase: "init",
					room: sessionRoom,
					response: {
						eventId: sessionId,
						sessionId: sessionId,
						userId: userId,
						appName: appName,
						rooms: rooms
					}
				}
			},{...addConfig})
        }).tapCatch((err) => {
			_log('err with init', err)
		})
})

sessionQueue.process('destroy', (job) => {

    const data = job.data
    const sessionId = data.sessionId
    const destroyType = data.destroyType

	_log('[Destroy]:', sessionId, destroyType)

    //Retrieve any existing rooms the user may be subscribed to
	return roomActions.commandUnSubSession(sessionId, destroyType).then((results) => 'OK')
        .catch((err) =>{
			_error('[Error Destroy]', err)
			throw new Error('Error '+ err.toString())
		})
})

botsQueue.process((job) => {

	const data 		= job.data
	const intent 	= data.intent
	const roomName 	= data.roomName
	const roomType 	= data.roomType
	_error('bots queue process', intent, roomName)

	let findBotCommand = () => {
		switch (intent) {
			case 'remove':
				return roomActions.removeBotFromRoom(roomName)
			case 'removeAll':
				return roomActions.removeAllBotsFromRoom(roomName)
			case 'add':
				return roomActions.addBotToRoom(roomName, roomType)
		}
	}

	//process bot command
	return findBotCommand(intent)
		.then((result) => {
			_log('result', result)
			return 'OK'
		})
		.catch((err) => {
			_error('[Error] @ botQ', err)
			throw new Error('Error '+ err.toString())
		})
})

sessionQueue.process('keepAlive', (job,) => {
    const data = job.data
    const sessionId = data.sessionId
    const params = JSON.stringify(data.params) || {}

    return client.keepAlive(sessionId, Date.now(), params)
	.then((result) => {
    	return 'OK'
    })
    .catch((err) => {
		_error('[Error KeepAlive]', err)
		throw new Error('Error '+ err.toString())
    })
})

//Run an expire check every second
sessionQueue.process('expireCheck', (job) => {

	_log('expire check')

    return client.zrangebyscore('tick|sessions', 0, Date.now()-60000, 'LIMIT', 0, 10)
        .map((sessionId) => {
		console.log('in map')
            console.log('[Expired Session]: ' + sessionId)

            return sessionQueue.add('destroy', {sessionId: sessionId, destroyType: 'expired'}, addConfig)
                .then((nestedJob) => nestedJob.finished())
                .then((nestedJobResult) => sessionId)
				.catch((err) => 'OK')
        })
        .then((results) => {
			return 'OK'
        })
        .catch((err) => {

            _log('[ERR @ expireCheck]' + err.toString())
			throw new Error('Error '+ err.toString())
		})
})

sessionQueue.isReady().then(() => {
	//sessionQueue.add('expireCheck', {}, {repeat: { cron: '*/5 * * * * *'}, removeOnComplete: true})
})


client.defineCommand('destroySession', {
	numberOfKeys: 2,
	lua: fs.readFileSync("./scripts/redis/destroySession.lua", "utf8")
})


client.defineCommand('validateAuths', {
    numberOfKeys: 1,
    lua: fs.readFileSync("./scripts/redis/validateAuths.lua", "utf8")
})

client.defineCommand('keepAlive', {
    numberOfKeys: 2,
    lua: fs.readFileSync("./scripts/events/keepAlive.lua", "utf8")
})

client.defineCommand('initSession', {
    numberOfKeys: 2,
    lua: fs.readFileSync("./scripts/redis/initSession.lua", "utf8")
})


roomSubQueue.on('error', function(job, err){
	_error('sub error', err)
})

sessionQueue.on('error', function(job, err){
	_error('sub error', err)
})

/*usageTimer = setInterval(() => {
    //_log("[Memory Usage]: %o", process.memoryUsage())
    //_log("[Node Clients]: %d", globals.getVariable("clientSocketsList").length)
    //_log("[Redis Clients]: %d", globals.getVariable("clientRedisList").length)
},30000);*/

module.exports = sessionQueue
