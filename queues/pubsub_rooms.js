//Global handler for all rooms
//TODO: rename from roomQueue to allRoomsQueue

const cluster       = require('cluster')
const fs            = require('fs') //https://github.com/visionmedia/debug
const debug         = require('debug') //https://github.com/visionmedia/debug
const Promise       = require('bluebird')
const globals       = require('../globals')
const helper          = require('../utils/helpers')
const redisManager  = require('../scripts/redis_manager')
const roomActions   = require('../scripts/room/shared')
const turnBasedActions 	= require('../scripts/room/turnbased')
const realTimeActions 	= require('../scripts/room/realtime')

const tickerQueue		  	= redisManager.tickerQueue
const sessionQueue  		= redisManager.sessionQueue
const roomSubQueue			= redisManager.roomSubQueue 		//handles sub/unsubs
const chatQueue		 		= redisManager.roomChatQueue 		//handles chat messages
const roomGameEventQueue	= redisManager.roomGameEventQueue 	//handles all general game events) sent to a room
const roomUpdateQueue		= redisManager.roomUpdateQueue		//handles room updates (like a constant message to  sent to a room
const botsQueue				= redisManager.botsQueue			//handles bot events
const roomQueue  			= redisManager.roomQueue 		//handles all general events for the room that doesn't need its' own queue

const client        		= redisManager.client
const roomEvents    = require('../scripts/room/events')
const _log = debug("roomQ"+ (cluster.isWorker ? ":"+cluster.worker.id : ""))
const _error = debug("error")

const addConfig = {
    attempts: 1,
	timeout: 3000,
	removeOnComplete: true
}

const SYSTEM_ROOM_TYPE = -1
const STANDARD_ROOM_TYPE = 0
const REALTIME_ROOM_TYPE = 1
const TURNBASED_ROOM_TYPE = 2

roomQueue.setMaxListeners(0)
roomSubQueue.setMaxListeners(0)



roomSubQueue.process('subscribe', (job) => {

	const data = job.data
	const sessionId 	= data.sessionId
	let roomList 		= data.rooms ? data.rooms : []
	let params 			= data.params || {}

	//append individual room
	if(data.room){
		let roomType = 0 //default
		roomType = params.isSystem ? -1 : roomType
		roomType = params.isGameRoom ? 1 : roomType
		roomType = params.isTurnBased ? 2 : roomType
		roomList.push([roomType, data.room, params])
	}

	//check if room list is empty
	if(roomList.length <= 0){
		return 'EMPTY'
	}

	//Check if session is active
	return client.checkSessionState(sessionId)
		.tap((result) => _log('[SUB] State', result.toString()))

		//Filter any duplicate game rooms passed in.
		.then(() => roomActions.filterMultipleGameRooms([sessionId, roomList, data.room])) //returns [sessionId, roomList] filtered
		.tap((result) => _log('[SUB] Filter Multi', result.toString()))

		//Check if reservation for room based on room type
		.then(roomActions.filterReservations) //returns [sessionId, roomList] filtered
		.tap((result) => _log('[SUB] Filter Reserve', result.toString()))

		//Check if user is already in the rooms passed in and filter out
		//.then(roomActions.filterExistingSubs) //returns [sessionId, roomList] filtered

		//check if we need to create room
		.then(roomActions.setupRooms) //returns [sessionId, roomList] creates any non existing rooms
		.tap((result) => _log('[SUB] Setup', result.toString()))

		//Remove session from any existing game rooms
		//.then(roomActions.checkForGameRoomsAndUnSub)

		//Subscribes to rooms and passes in params from job.
		.then(roomActions.subToRooms) //subscribes to rooms
		.tap((result) => _log('[SUB] Sub', result.toString()))

		.then(() => 'OK')

		.tapCatch(() => roomSubQueue.add('unsubscribe', {sessionId: sessionId, rooms: roomList}, addConfig))
		.catch((err) => {
			_error('[Error Subscribe]', err.status, err.message)
			console.log(err, err.stack.split("\n"))

			if(err.message === "NO SESSION"){
				//todo: fail the room
			}

			throw new Error('Subscribe Error '+ err.toString())
		})
})

roomSubQueue.process('unsubscribe', (job) => {

	const data 				= job.data
	const sessionId 		= data.sessionId
	const roomList 			= data.rooms || []
	const removeEmptyRooms	= data.removeEmptyRooms || true

	//append individual room
	if(data.roomName){
		roomList.push(data.roomName)
	}

	//check if room list is empty
	if(roomList.length <= 0) return 'EMPTY'

	//Check if session is active
	return client.checkSessionState(sessionId)
		.tap((result) => _log('[UNSUB] State', result.toString()))
		.then((state) => roomActions.checkNonExistingSubsAndType([sessionId, roomList, removeEmptyRooms])) //required
		.tap((result) => _log('[UNSUB] Check non', result.toString()))
		.then(roomActions.unSubFromRooms)
		.tap((result) => _log('[UNSUB] Unsub', result.toString()))
		.then(() => 'OK')
		.catch((err) => {
			_error('[Error Unsubscribe]', err.status, err.message)
			console.log(err, err.stack.split("\n"))
			throw new Error('Error '+ err.toString())
		})
})


roomSubQueue.process('onPlayerSubscribe', (job, done) => {
    const data = job.data
    //const sessionId = data.sessionId
    const roomName 	= data.roomName
    const roomType 	= data.roomType
    const isBot 	= data.bot
    const roomArr 	= helper._roomNameToArr(roomName)
    const roomAppGameName   = roomArr.roomAppGameName || ''
    const roomGame          = roomArr.roomGame || ''
    const roomTheme         = roomArr.roomTheme || ''

	let prepareResponse = {}

	switch(roomGame){
		case 'blackjack':
		case 'roulette':
			prepareResponse.players 	= roomActions.getPlayersDataFromGameRoom(data.roomName, {roomType: data.roomType})
			prepareResponse.matchState	= turnBasedActions.getMatchState(data.roomName)
			prepareResponse.matchData 	= turnBasedActions.getMatchData(data.roomName)
			break
		case 'slots':
		case 'poker':
		case 'bingo':
		case 'keno':
			prepareResponse.roomState 	= realTimeActions.getRoomState(data.roomName)
			prepareResponse.roomData 	= realTimeActions.getRoomData(data.roomName)
			prepareResponse.players 	= roomActions.getPlayersDataFromGameRoom(data.roomName, {roomType: data.roomType})
			break
	}

	switch(roomTheme){
        case 'lobby':
			prepareResponse = { counts: roomActions.getThemeCounts(roomAppGameName) }
            break
    }

	//don't process if nothing was added to prepare response
	if(helper._isEmptyObject(prepareResponse)){
		done(null, [roomType,roomName])
		return
	}

	//attach room name to response
	prepareResponse.roomName = roomName
	prepareResponse.roomType = roomType

	return Promise.props(prepareResponse)

		//hook into the response in it's own thread
		.tap((response) => {
			let roomInfo
			if(response.matchData)
				roomInfo = response.matchData
			else if(response.roomData)
				roomInfo = response.roomData

			//add bots with one open spot
			if(roomInfo && roomTheme !== "lobby"){
				const numBots = parseInt(roomInfo.bots) || 0
				const maxBots = parseInt(roomInfo.maxBots)
				const numSubscribers = parseInt(roomInfo.subscribers)
				const maxSubscribers = parseInt(roomInfo.maxSubscribers)
				const openSpots = maxSubscribers - numSubscribers
				const openSpotsWithoutBots = maxSubscribers - (numSubscribers - numBots)

				if(isBot && numBots === numSubscribers){
					_error('REMOVE A BOT')

				}

				//remove bots if full or completely empty
				if((openSpots === 0 && openSpotsWithoutBots > 1) || (openSpotsWithoutBots === maxSubscribers && isBot)){
					return botsQueue.add({roomName: response.roomName, intent:"remove"},{jobId: response.roomName+":"+openSpots, ...addConfig})
				} else if(openSpotsWithoutBots > 1 && numBots < maxBots){
					return botsQueue.add({roomName: response.roomName, roomType: response.roomType, intent:"add"},{jobId: response.roomName+":"+openSpots, ...addConfig})
				}
			}

		})

		.then((response) => {
			const message = JSON.stringify({
				phase: "roomUpdate",
				room: response.roomName,
				response: response
			})
			return client.publishToRoom(response.roomName, message)
		})
		.then((result) => {
			prepareResponse = {}
			done(null, [roomType,roomName])
		})
		.tapCatch(_error)
		.catch((err) => {
			_error('[Error OnSubscribe]', err)
		})
})

roomUpdateQueue.process('roomUpdate', (job) => {
	const data = job.data
	//const sessionId = data.sessionId
	const roomName 	= data.roomName
	const roomType 	= data.roomType
	const isBot 	= data.bot
	const roomArr 	= helper._roomNameToArr(roomName)
	const roomAppGameName   = roomArr.roomAppGameName || ''
	const roomGame          = roomArr.roomGame || ''
	const roomTheme         = roomArr.roomTheme || ''

	let prepareResponse = {}

	switch(roomGame){
		case 'blackjack':
		case 'roulette':
			prepareResponse.players 	= roomActions.getPlayersDataFromGameRoom(data.roomName, {roomType: data.roomType})
			prepareResponse.matchState	= turnBasedActions.getMatchState(data.roomName)
			prepareResponse.matchData 	= turnBasedActions.getMatchData(data.roomName)
			break
		case 'slots':
		case 'poker':
		case 'bingo':
		case 'keno':
			prepareResponse.players = roomActions.getPlayersDataFromGameRoom(data.roomName, {roomType: data.roomType})
			break
	}

	switch(roomTheme){
		case 'lobby':
			prepareResponse = {counts: roomActions.getThemeCounts(roomAppGameName)}
			break
	}

	//don't process if nothing was added to prepare response
	if(helper._isEmptyObject(prepareResponse)){
		return Promise.resolve([roomType,roomName])
	}

	//attach room name to response
	prepareResponse.roomName = roomName
	prepareResponse.roomType = roomType

	return Promise.props(prepareResponse)

		.tap((response) => {
			if(response.players){
				const realSubs = response.players.filter((sub) => typeof(sub.bot) !== 'string' && sub.bot !== 'true')
				const numSubs = realSubs.length || 0

				if(numSubs === 0){
					return botsQueue.add({roomName: response.roomName, intent:"removeAll"},{jobId: response.roomName+":remove", ...addConfig} )
				}
			}
		})

		.then((response) => {
			const serverTime = globals.getVariable("SERVER_TIME")
			const message = JSON.stringify({
				phase: "roomUpdate",
				room: response.roomName,
				response: response
			})
			return client.publishToRoom(response.roomName, message)
		})
		.then((result) => {
			prepareResponse = {}
			return [roomType,roomName]
		})
		.tapCatch(_error)
		.catch((err) => {
			_error('[Error update]', err)
		})
})

roomSubQueue.process('onPlayerUnSubscribe', (job) => {
	const data = job.data
	//const sessionId = data.sessionId
	const roomName 	= data.roomName
    const roomType 	= data.roomType
	const isBot 	= data.bot
	const roomArr 	= helper._roomNameToArr(roomName)
	const roomAppGameName   = roomArr.roomAppGameName || ''
	const roomGame          = roomArr.roomGame || ''
	const roomTheme         = roomArr.roomTheme || ''

	let prepareResponse = {}

	switch(roomGame){
		case 'blackjack':
		case 'roulette':
			prepareResponse.players 	= roomActions.getPlayersDataFromGameRoom(data.roomName, {roomType: data.roomType})
			prepareResponse.matchState	= turnBasedActions.getMatchState(data.roomName)
			prepareResponse.matchData 	= turnBasedActions.getMatchData(data.roomName)
			break
		case 'slots':
		case 'poker':
		case 'bingo':
		case 'keno':
			prepareResponse.roomState 	= realTimeActions.getRoomState(data.roomName)
			prepareResponse.roomData 	= realTimeActions.getRoomData(data.roomName)
			prepareResponse.players = roomActions.getPlayersDataFromGameRoom(data.roomName, {roomType: data.roomType})
			break
	}

	switch(roomTheme){
		case 'lobby':
			prepareResponse = {counts: roomActions.getThemeCounts(roomAppGameName)}
			break
	}

	//don't process if nothing was added to prepare response
	if(helper._isEmptyObject(prepareResponse)){
		return [roomType,roomName]
	}

	//attach room name to response
	prepareResponse.roomName = roomName
	prepareResponse.roomType = roomType

	return Promise.props(prepareResponse)

		//hook into the response in it's own thread
		.tap((response) => {
			let roomInfo
			if(response.matchData)
				roomInfo = response.matchData
			else if(response.roomData)
				roomInfo = response.roomData

			//add bots with one open spot
			if(roomInfo && roomTheme !== "lobby"){
				const numBots = parseInt(roomInfo.bots) || 0
				const maxBots = parseInt(roomInfo.maxBots)
				const numSubscribers = parseInt(roomInfo.subscribers)
				const maxSubscribers = parseInt(roomInfo.maxSubscribers)
				const openSpots = maxSubscribers - numSubscribers
				const openSpotsWithoutBots = maxSubscribers - (numSubscribers - numBots)

/*				if(isBot && numBots === numSubscribers && openSpots !== maxSubscribers){
					_error('REMOVE A BOT!')
					return botQueue.add({roomName: response.roomName, intent:"removeAll"},{jobId: response.roomName+":"+openSpots} )
				}*/

				//remove bots if full
				if((openSpots === 0 && openSpotsWithoutBots > 1) || (openSpotsWithoutBots === maxSubscribers) || (numBots === numSubscribers && isBot)){
					return botsQueue.add({roomName: response.roomName, intent:"remove"},{jobId: response.roomName+":"+openSpots, ...addConfig} )
				} else if(openSpotsWithoutBots > 1 && numBots < maxBots && !isBot){ //only add bots on unsub when it is not a user
					return botsQueue.add({roomName: response.roomName, roomType: response.roomType, intent:"add"},{jobId: response.roomName+":"+openSpots, ...addConfig} )
				}
			}
		})

		.then((response) => {
			const serverTime = globals.getVariable("SERVER_TIME")
			const message = JSON.stringify({
				phase: "roomUpdate",
				room: response.roomName,
				response: response
			})
			return client.publishToRoom(response.roomName, message)
		})
		.then((result) => {
			prepareResponse = {}
			return [roomType,roomName]
		})
		.tapCatch(_error)
		.catch((err) => {
			_error('[Error OnUnSubscribe]', err)
		})
})

roomSubQueue.process('publish', (job, done) => {
    const data = job.data
    const skipChecks = data.skipChecks ? 'FORCE' : ''
    const message = data.message
	const serverTime = globals.getVariable("SERVER_TIME")

	_log('publishing', serverTime)
    client.publishToRoom(message.room, JSON.stringify(message), skipChecks)
        .then((results) => {
    	_log('published message', message.room, results)
    		done(false, 'OK')
        })
        .catch((err) => {
			_error('[Error Publish]', err)
			done('Error Publish '+ err.toString())
        })
})

roomQueue.process('sendChatToRoom', (job) => {
    const data = job.data
	const serverTime = globals.getVariable("SERVER_TIME")

    return client.sendChatToRoom(data.sessionId, data.room, data.message, data.eventId, serverTime)
        .then((results) => {
        })
        .catch((err) => {
			_error('[Error Chat]', err)
        })
})

//for server controlled events
roomQueue.process('sendServerRoomEvent', (job, done) => {
    const data = job.data
	done(null, 'OK')
})

//acknowledgement that player received the server room event message
roomQueue.process('receivedServerRoomEvent', (job, done) => {
	const data = job.data
	done(null, 'OK')
})


roomQueue.process('prepareSyncSessionData', (job) => {
    const data          = job.data
    const sessionId     = data.sessionId
    const prepParams    = data.params
    const eventId       = prepParams.eventId
    const eventParams   = prepParams.params
    const username          = eventParams.username
    const score             = eventParams.score
    const level             = eventParams.level
    const subCurrency       = eventParams.subCurrency
    const avatar            = eventParams.avatar
    const auth              = eventParams.auth
    const forceRoomUpdate   = eventParams.forceRoomUpdate
    const paramsMsg         = JSON.stringify(eventParams)
	const serverTime 		= globals.getVariable("SERVER_TIME")

    const validateAuths = () => {
        return client.validateAuths(sessionId, auth).then((result) => result)
    }

    const validateString = (item) => {
        if (!item || typeof(item) !== "string") {
            throw new Error('invalid string')
        }
        return true
    }

    const validateNumber = (item, min, max) => {
        if(!item || typeof(item) !== "number"){ throw new Error('invalid number')}
        if(min && item < min){ throw new Error('invalid number')}
        if(max && item > max){ throw new Error('invalid number')}
        return true
    }

    return Promise.all([
        validateAuths(),
        validateString(username),
        validateString(avatar),
        validateNumber(score),
        validateNumber(level),
        validateNumber(subCurrency)
    ])
        .then((result) => client.prepareRoomEvent(sessionId, "sessions:" + sessionId, eventId, 'syncSessionData', serverTime, paramsMsg, 'sendRoomEvent', 'syncSessionDataResponse'))
        .then((result2) => {
        })
/*        .catch((err) => {
        })*/
})

roomQueue.process('syncSessionData', (job) => {
    const data              = job.data
    const sessionId         = data.sessionId
    const forceRoomUpdate   = data.forceRoomUpdate

    return client.updateSessionData(sessionId,
        'username', data.username,
        'score', data.score,
        'avatar', data.avatar,
        'level', data.level,
        'subCurrency', data.subCurrency
    )
		.tap((result) => {
			if(forceRoomUpdate){
				return roomActions.getGameRoomBySessionId(sessionId)
					.then(roomActions.commandPublishGameRoomUpdate)
			}
		})
        .then((results) => {
        })
/*        .catch((err) => {
			_error('[Error Sync]', err)
			_log('err on sync '+err.toString())
        })*/
})

roomQueue.process('prepareRoomEvent', (job) => {
    const data = job.data.params
    const eventId       = data.eventId
    const roomName      = data.room
    const sessionId     = data.sessionId
    const eventTable    = data.params
    const eventName        = eventTable.event
    const eventParams      = eventTable.data
	const serverTime = globals.getVariable("SERVER_TIME")

    //we process the function in, then when user verifies our send back,
    //we post the results to the specified room

    let validateEvent = () => {
        const eventFunctName = "_"+eventName
        if (!eventName || typeof(eventName) !== "string" || (typeof roomEvents[eventFunctName] === 'undefined')) {
            throw new Error('invalid event name')
        }
        return roomEvents[eventFunctName](sessionId, eventParams)
            .then((eventResponse) => {
               return client.prepareRoomEvent(sessionId, roomName, eventId, eventName, serverTime, JSON.stringify(eventResponse), 'sendRoomEvent', 'receiveRoomEvent')
            })
    }

    return Promise.all([
        validateEvent()
    ]).then((results) => {
    })
/*    .catch((err) => {
    })*/
})

roomQueue.process('verifyRoomEvent', (job) => { //verifies an eventId for room queue processing.
    const data = job.data
	const serverTime = globals.getVariable("SERVER_TIME")

    const sessionId = data.sessionId
    const eventId   = data.eventId

    return client.verifyRoomEvent(sessionId, eventId, serverTime)
        .then((jsoned) => {
            let eventName = eventId.split('|')[1]

			_log('json sub', jsoned)

			let parsed = jsoned && helper._isJson(jsoned) ? JSON.parse(jsoned) : {}
            if(!eventName) throw new Error('no event name found')

            _log('-----event found -0---')
            _log(eventName)
            _log(parsed)
            _log('-----###event found -0---')
            return [eventName, parsed]
        })
        .then((results) => {
        })
/*        .catch((err) => {
        })*/
})
/*roomQueue.process('roomUpdate', (job, done) => {
    const data = job.data

    return roomActions.roomUpdate(data.roomName)
        .then((results) => {
            done()
        })
        .catch((err) => {
    		_log('error  on roomupadte', err.toString())
            done(err.toString())
        })
})*/

//Run a room clean up every night at 11:59 to get rooms that haven't updated in the past day (-1's are ignored)
roomQueue.process('expireCheck', (job, done) => {
	done(false, 'derp')
   /* let d = new Date()
    d.setDate(d.getDate() - 1)
    let expirationTime = d.getTime()

	_log('expirecheck')
	return client.multi().zrangebyscore('tick|rooms', 1, Date.now()-60000, 'LIMIT', 0, 10).exec()
		.tap(_error)
		.then(([err,results]) => results)
        .each((roomName) => {
            _log('[Expired Room]: ' + roomName)

			//get all sessions in the room w/ roomType
			return roomActions.getSubscriptionsBySessionId(roomName)
                //send an unsubscribe request with high priority (and will take care of destruction automatically.. hopefully)
                .then(([roomType, sessionId]) => roomSubQueue.add('unsubscribe', { sessionId: sessionId, rooms: [[roomType, roomName]]}, {priority: 3, ...addConfig}))
                //ensure the job will finish with their own interval checker
                .then((nestedJobResult) => roomName)
                .catch((err) =>{
					_log('[ERR @ roomTick]' + err.toString())
					return roomName
				})
        })
        .then((results) => {
            _log('mapping done ', results)
			return 'OK'
        })
/!*        .catch((err) => {
            _log('[ERR @ expireCheck]' + err.toString())
        })*!/*/
})

//Check those rooms who are past the tick update time.
tickerQueue.process((job) => {
	_log('room queue process')
	return roomActions.commandRoomTick(job).tapCatch((err) => _error('process tick err', err))
})
//tickerQueue.add({roomTick:true}, {repeat: { cron: '*/10 * * * * *'}, removeOnComplete: true})

client.defineCommand('publishToRoom', {
    numberOfKeys: 2,
    lua: fs.readFileSync("./scripts/redis/publishToRoom.lua", "utf8")
})


roomSubQueue.on('active', (job, jobPromise) => {

/*
	tickerQueue.pause()
*/

	globals.setVariable('SERVER_TIME', Date.now())

/*	return roomActions.updateServerTime().then(()=>{
	})*/
})


tickerQueue.on('active', (job, jobPromise) => {

/*	//check if we should pause tickerQueue due to no users connected
	client.exists('tick|sessions').then((doesExist) => {
		_log('num exists', doesExist)

		if(doesExist === 0){
			_log('[ALERT] Stop and Pause Ticker Queue due to 0 Users')
			jobPromise.cancel()
			tickerQueue.pause()
		} else {
			tickerQueue.resume()
		}
	})*/
})

tickerQueue.on("completed", function(job){

	_log('completed ticker queue')
	//check if we should pause tickerQueue due to no users connected
/*	client.exists('tick|sessions').then((doesExist) => {
		_log('num exists', doesExist)

		if(doesExist === 0){

			_log('[ALERT] Pausing Ticker Queue due to 0 Users')
			//roomSubQueue.clean(5000)
			tickerQueue.pause()
		} else {
			//tickerQueue.resume()
		}
	})*/
})

roomSubQueue.on("global:completed", function(job){
	//check if we should pause tickerQueue due to no users connected
/*	client.exists('tick|sessions').then((doesExist) => {

		if(doesExist === 0){

			_log('[ALERT] Pausing Ticker Queue due to 0 Users')
			//roomSubQueue.clean(5000)
			tickerQueue.pause()
		} else {
			tickerQueue.resume()
		}
	})*/
})

//Clean up the onPlayerSub/Unsubs when many people join at the same time.
roomQueue.on('stalled', function(job){
	const jobId = job.jobId
})

//Clean up the onPlayerSub/Unsubs when many people join at the same time.
roomQueue.on('error', function(job){
	const jobId = job.jobId

	if(jobId && jobId.startsWith('onPlayerSubscribe:')){

	}
	console.log('err @ roomQueue')

	console.log(job)
})

//Clean up the onPlayerSub/Unsubs when many people join at the same time.
roomSubQueue.on('error', function(job){
	const jobId = job.jobId

	console.log('err @ roomSubQ')
	console.log(job)
})

module.exports = roomQueue
