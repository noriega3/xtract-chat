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
    attempts: 1,
    removeOnComplete: true,
	//timeout: 10000,
	backoff: {
    	type: 'fixed',
		delay: 500
	}
}
sessionQueue.setMaxListeners(0)

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
	const serverTime = globals.getVariable('SERVER_TIME')

    //adds playerData to the new object to be set in session:*id*
    let sessionData = Object.assign({ sessionId:sessionId, online: 1, created: serverTime }, playerData)
    let objSessionData = helper._convertObjectToArray(sessionData)
    let roomList
	job.progress(25)

	//Hook in single app user check
    return sessionQueue.add('sendSsoCheck', {
			sessionId: sessionId,
			appName: appName,
			userId: userId
		}, {...addConfig})
		.then((nestedJob) => nestedJob.finished())

		//normal init function
		.then(() => client.initSession(sessionId, objSessionData))

		.tap((result) => _log('[INIT] Setup', result.toString()))

		.then((rooms) => {
			job.progress(50)
			roomList = helper._arrToSet(rooms)
            return roomQueue.add('subscribe', {
                sessionId: sessionId,
                rooms: roomList,
                userId: userId,
                appName: appName,
            }, {...addConfig})
		})
		.then((nestedJob) => nestedJob.finished())
		.tap((result) => _log('[INIT] Sub Job', result.toString()))

		.then(() => {
			job.progress(75)
			const rooms = helper._remapToObject(roomList)
			const message = JSON.stringify({
				phase: "init",
				room: sessionRoom,
				response: {
					eventId: sessionId,
					sessionId: sessionId,
					userId: userId,
					appName: appName,
					rooms: rooms
				}
			})
			return client.publishToSession(sessionId, message)
		})
		.tap((result) => _log('[INIT] Publish', result.toString()))

		.then(() => 'OK')

		.tapCatch(()=>roomActions.commandUnSubSession(sessionId, 'error'))
		.catch((err) => {
			_error('[ERROR INIT]' + err.status, err.message)
			console.log(err, err.stack.split("\n"))

			throw new Error('Init Error '+ err.toString())
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
	const roomGame 	= data.roomGame
	const roomTheme = data.roomTheme

	let findBotCommand = () => {
		switch (intent) {
			case 'remove':
				return roomActions.removeBotFromRoom(roomName)
			case 'removeAll':
				return roomActions.removeAllBotsFromRoom(roomName)
			case 'add':
				return roomActions.addBotToRoom(roomName, roomType, roomGame, roomTheme)
		}
	}

	//process bot command
	return findBotCommand(intent)
		.tap((result) => _log('[BOT] Command', result.toString()))
		.then(() => 'OK')
		.tapCatch((err) => {
			_error('[ERROR BOT]' + err.status, err.message)
			console.log(err, err.stack.split("\n"))
		})
})

sessionQueue.process('keepAlive', (job) => {
    const data = job.data
    const sessionId = data.sessionId
    const params = JSON.stringify(data.params) || {}
    const serverTime = globals.getVariable("SERVER_TIME")

    return client.keepAlive(sessionId, params)
	.then((result) => {
    	return 'OK'
    })
    .catch((err) => {
		_error('[Error KeepAlive]', err)
		throw new Error('Error '+ err.toString())
    })
})

sessionQueue.process('sendSsoCheck', (job) => {
	const data = job.data
	const sessionId = data.sessionId
	const userId = data.userId
	const appName = data.appName

	return client.sendSsoCheck(userId, sessionId, appName)
		.then((result) => {
			_log('sendsso', result)
			return 'OK'
		})
		.catch((err) => {
			_error('[Error sendSsoCheck]', err)
			throw new Error('Error '+ err.toString())
		})
})


sessionQueue.process('verifySsoCheck', (job) => {
	const data = job.data
	const sessionId = data.sessionId
	const rawMessage = data.rawMessage

	return client.verifySsoCheck(sessionId, rawMessage)
		.then((result) => {
			_log('r', result)

			return 'OK'
		})
		.catch((err) => {

			_log('WOULD LOG OUT HERE')
/*			return sessionQueue.add('destroy', {sessionId: sessionId, destroyType: 'expired'}, addConfig)
				.then((nestedJob) => nestedJob.finished())
				.then((nestedJobResult) => sessionId)
				.catch((err) => 'OK')*/

			_error('[Error verifySsoCheck]', err)
			throw new Error('Error '+ err.toString())
		})
})

//Run an expire check every second
sessionQueue.process('expireCheck', (job) => {
    return client.getServerTime().then((serverTime) => client.zrangebyscore('tick|sessions', 0, serverTime-60000, 'LIMIT', 0, 10))
        .map((sessionId) => {
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

/*sessionQueue.isReady().then(() => {
	return roomActions.updateServerTime()
	//sessionQueue.add('expireCheck', {}, {repeat: { cron: '*!/5 * * * * *'}, removeOnComplete: true})
})*/

client.defineCommand('sendSsoCheck', {
	numberOfKeys: 2,
	lua: fs.readFileSync("./scripts/redis/session/sendSsoCheck.lua", "utf8")
})

client.defineCommand('verifySsoCheck', {
	numberOfKeys: 2,
	lua: fs.readFileSync("./scripts/redis/session/verifySsoCheck.lua", "utf8")
})

client.defineCommand('publishToSession', {
	numberOfKeys: 2,
	lua: fs.readFileSync("./scripts/redis/session/publishToSession.lua", "utf8")
})

client.defineCommand('validateAuths', {
    numberOfKeys: 1,
    lua: fs.readFileSync("./scripts/redis/validateAuths.lua", "utf8")
})

client.defineCommand('keepAlive', {
    numberOfKeys: 1,
    lua: fs.readFileSync("./scripts/redis/session/keepAlive.lua", "utf8")
})

client.defineCommand('initSession', {
    numberOfKeys: 1,
    lua: fs.readFileSync("./scripts/redis/session/initSession.lua", "utf8")
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
