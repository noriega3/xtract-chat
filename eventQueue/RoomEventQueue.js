//Global handler for all rooms
//TODO: rename from roomQueue to allRoomsQueue
"use strict"
const _       		= require('lodash') //https://lodash.com/docs/4.17.4
const cluster       = require('cluster')
const debug         = require('debug') //https://github.com/visionmedia/debug
const Promise       = require('bluebird')
const helper        = require('../util/helpers')
const store			= require('../store')
const db			= store.database
const getConnection	= store.database.getConnection
const queues		= store.queues
const turnBasedActions 	= require('../scripts/room/turnbased')
const realTimeActions 	= require('../scripts/room/realtime')
const roomEvents    = require('../scripts/room/events')
const _log = debug("roomQ"+ (cluster.isWorker ? ":"+cluster.worker.id : ""))
const _error = debug("roomQError")
const parseLodash = (str) => {
	return _.attempt(JSON.parse.bind(null, str));
}

const addConfig = {
    attempts: 1,
	timeout: 3000,
	removeOnComplete: false,
}
const RoomActions 	= require('../scripts/room/shared')
const Queue 		= require('../scripts/queue')
const _identifier 	= 'roomQueue'

//jobs

const jobSubscribe = require('../scripts/jobs/subscribe.js')
const jobUnSubscribe = require('../scripts/jobs/unsubscribe.js')

const RoomEventQueue = () => {
	const _queue = Queue(_identifier)
	setupQueue(_queue)
	return queues.addQueue({
		_identifier,
		getName: () => _identifier,
		getQueue: () => _queue
	})
}

const setupQueue = (queue) => {

	//roomSubQueue.setMaxListeners(0)
	queue.process('subscribe', 10, jobSubscribe)
	queue.process('unsubscribe', 10, jobUnSubscribe)

	queue.process('onPlayerSubscribe', 1, (job) => {
		const data = job.data
		//const sessionId = data.sessionId
		const roomName 	= data.roomName
		const roomType 	= data.roomType
		const isBot 	= data.bot

		return Promise.using(getConnection(), (client) => {
			//Check if room is active
			return client.checkRoomTick(roomName)
				.then(() => {
					switch(_.toNumber(roomType)){
						case REALTIME_ROOM_TYPE:
							return realTimeActions.processTickEvent(roomName)
						case TURNBASED_ROOM_TYPE:
							return turnBasedActions.processTickEvent(roomName)
						default:
							new Error('[On Sub] Room Error: Wrong type of room')
					}
				})
				.tap((raw) => {
					if(!raw) return false
					const parsed = parseLodash(raw)
					if(!parsed || !parsed.response || !parsed.response.roomData) return false
					const roomInfo = parsed.response.roomData
					const roomArr 	= helper._roomNameToArr(roomName)
					const roomAppGameName   = roomArr.roomAppGameName || ''
					const roomGame          = roomArr.roomGame || ''
					const roomTheme         = roomArr.roomTheme || ''

					//add bots with one open spot
					if(roomInfo && roomTheme !== "lobby"){

						return client.getRoomBotInfo(roomName).then((rawBotInfo) => {
							if(!rawBotInfo) return false
							const botInfo = parseLodash(rawBotInfo)
							if(!botInfo || !botInfo.botData ) return false
							const botData = botInfo.botData
							const openSpots = _.subtract(botData.maxBots,botData.bots)
							const botsQueue		= queues.getQueueByName('botsQueue')			//handles bot events

							if(openSpots < 0 && isBot) {
								return botsQueue.add({roomName: roomName, intent:"remove"},{jobId: roomName+":"+openSpots, ...addConfig})
							} else if(openSpots > 0){
								return botsQueue.add({roomName: roomName, roomTypeId: roomInfo.roomTypeId, roomGame: roomGame, roomTheme: roomTheme, intent:"add"},{jobId: roomName+":"+openSpots, ...addConfig})
							}

							/*
                                                const numBots = parseInt(roomInfo.bots) || 0
                                                const numSubscribers = parseInt(roomInfo.subscribers)
                                                const maxSubscribers = parseInt(roomInfo.maxSubscribers)
                                                const maxBots = parseInt(roomInfo.maxSubscribers) - 1
                                                const openSpots = maxSubscribers - numSubscribers
                                                const openSpotsWithoutBots = maxSubscribers - (numSubscribers - numBots)

                                                //remove bots if full or completely empty
                                                if((openSpots === 0 && openSpotsWithoutBots > 1) || (openSpotsWithoutBots === maxSubscribers && isBot)){
                                                    _log('adding bots', openSpots)
                                                    return botsQueue.add({roomName: roomInfo.roomName, intent:"remove"},{jobId: roomInfo.roomName+":"+openSpots, ...addConfig})
                                                } else if(openSpotsWithoutBots > 1 && numBots < maxBots){
                                                    return botsQueue.add({roomName: roomInfo.roomName, roomType: roomInfo.roomType, roomGame: roomGame, roomTheme: roomTheme, intent:"add"},{jobId: roomInfo.roomName+":"+openSpots, ...addConfig})
                                                }*/
						})
					}
					return true
				})
				.then(() => [roomType,roomName])
				//.finally(() => client.quit())
				.catch((err) => {
					_error('[Error OnSubscribe]', err.status, err.message)
					console.log(err, err.stack.split("\n"))
					throw new Error('Room Error '+ err.toString())
				})
		})

	})

	/*roomQueue.process('roomUpdate', (job) => {
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
                prepareResponse.players 	= RoomActions.getPlayersDataFromGameRoom(data.roomName, {roomType: data.roomType})
                prepareResponse.matchState	= turnBasedActions.getMatchState(data.roomName)
                prepareResponse.matchData 	= turnBasedActions.getMatchData(data.roomName)
                prepareResponse.turnExpiration = prepareResponse.turnExpireTime
                prepareResponse.gameState = prepareResponse.matchState
                break
            case 'slots':
            case 'poker':
            case 'bingo':
            case 'keno':
                prepareResponse.players = RoomActions.getPlayersDataFromGameRoom(data.roomName, {roomType: data.roomType})
                break
        }

        switch(roomTheme){
            case 'lobby':
                prepareResponse = {counts: RoomActions.getThemeCounts(roomAppGameName)}
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
            .catch((err) => {
                _error('[Error update]', err)
            })
    })*/

	queue.process('onPlayerUnSubscribe', 2, (job) => {
		const data = job.data
		//const sessionId = data.sessionId
		const roomName 	= data.roomName
		const roomType 	= data.roomType
		const isBot 	= data.bot

		//Check if room is active
		return client.checkRoomTick(roomName)
			.then(() => {
				switch(_.toNumber(roomType)){
					case REALTIME_ROOM_TYPE:
						return realTimeActions.processTickEvent(roomName)
					case TURNBASED_ROOM_TYPE:
						return turnBasedActions.processTickEvent(roomName)
					default:
						new Error('[On Sub] Room Error: Wrong type of room')
				}
			})
			.tap((raw) => {
				if(!raw) return false
				const parsed = parseLodash(raw)
				if(!parsed || !parsed.response || !parsed.response.roomData) return false
				const roomInfo = parsed.response.roomData
				const roomArr 	= helper._roomNameToArr(roomName)
				const roomAppGameName   = roomArr.roomAppGameName || ''
				const roomGame          = roomArr.roomGame || ''
				const roomTheme         = roomArr.roomTheme || ''

				//add bots with one open spot
				if(roomInfo && roomTheme !== "lobby"){

					return client.getRoomBotInfo(roomName).then((rawBotInfo) => {
						if(!rawBotInfo) return false
						const botInfo = parseLodash(rawBotInfo)
						if(!botInfo || !botInfo.botData ) return false
						const botData = botInfo.botData
						const openSpots = _.subtract(botData.maxBots,botData.bots)

						if(openSpots < 0) {
							return botsQueue.add({roomName: roomName, intent:"remove"},{jobId: roomName+":"+openSpots, ...addConfig})
						} else if(openSpots > 0 && !isBot){
							return botsQueue.add({roomName: roomName, roomTypeId: roomInfo.roomTypeId, roomGame: roomGame, roomTheme: roomTheme, intent:"add"},{jobId: roomName+":"+openSpots, ...addConfig})
						}
					})
					/*

                    const numBots = parseInt(roomInfo.bots) || 0
                    const maxBots = parseInt(roomInfo.maxBots)
                    const numSubscribers = parseInt(roomInfo.subscribers)
                    const maxSubscribers = parseInt(roomInfo.maxSubscribers)
                    const openSpots = maxSubscribers - numSubscribers
                    const openSpotsWithoutBots = maxSubscribers - (numSubscribers - numBots)

                    //remove bots if full or completely empty
                    if((openSpots === 0 && openSpotsWithoutBots > 1) || (openSpotsWithoutBots === maxSubscribers) || (openSpotsWithoutBots === maxSubscribers && isBot)){
                        return botsQueue.add({roomName: response.roomName, intent:"remove"},{jobId: response.roomName+":"+openSpots, ...addConfig})
                    } else if(openSpotsWithoutBots > 1 && numBots < maxBots && !isBot){
                        return botsQueue.add({roomName: response.roomName, roomType: response.roomType, roomGame: roomGame, roomTheme: roomTheme, intent:"add"},{jobId: response.roomName+":"+openSpots, ...addConfig})
                    }*/
				}
				return true
			})
			.then(() => [roomType,roomName])
			.catch((err) => {
				_error('[Error OnUnSubscribe]', err.status, err.message)
				console.log(err, err.stack.split("\n"))
				throw new Error('Room Error '+ err.toString())
			})

		/*const data = job.data
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
            case 'bingo':
                prepareResponse.players 	= RoomActions.getPlayersDataFromGameRoom(data.roomName, {roomType: data.roomType})
                prepareResponse.matchState	= turnBasedActions.getMatchState(data.roomName)
                prepareResponse.matchData 	= turnBasedActions.getMatchData(data.roomName)
                prepareResponse.turnExpiration = prepareResponse.turnExpireTime
                prepareResponse.gameState = prepareResponse.matchState

                break
            case 'slots':
            case 'poker':
            case 'keno':
                prepareResponse.roomState 	= realTimeActions.getRoomState(data.roomName)
                prepareResponse.roomData 	= realTimeActions.getRoomData(data.roomName)
                prepareResponse.players = RoomActions.getPlayersDataFromGameRoom(data.roomName, {roomType: data.roomType})
                break
        }

        switch(roomTheme){
            case 'lobby':
                prepareResponse = {counts: RoomActions.getThemeCounts(roomAppGameName)}
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

                    //remove bots if full
                    if((openSpots === 0 && openSpotsWithoutBots > 1) || (openSpotsWithoutBots === maxSubscribers) || (numBots === numSubscribers && isBot)){
                        return botsQueue.add({roomName: response.roomName, intent:"remove"},{jobId: response.roomName+":"+openSpots, ...addConfig} )
                    } else if(openSpotsWithoutBots > 1 && numBots < maxBots && !isBot){ //only add bots on unsub when it is not a user
                        return botsQueue.add({roomName: response.roomName, roomType: response.roomType, roomGame: roomGame, roomTheme: roomTheme, intent:"add"},{jobId: response.roomName+":"+openSpots, ...addConfig} )
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
                return [roomType,roomName]
            })
            .tapCatch(_error)
            .catch((err) => {
                _error('[Error OnUnSubscribe]', err)
            })*/
	})

	queue.process('publish', (job, done) => {
		const data = job.data
		const skipChecks = data.skipChecks ? 'FORCE' : ''
		const message = data.message
		const serverTime = Date.now()

		client.publishToRoom(message.room, Date.now(), JSON.stringify(message), skipChecks)
			.then((results) => {
				done(false, 'OK')
			})
			.catch((err) => {
				_error('[Error Publish]', err)
				done('Error Publish '+ err.toString())
			})
	})

	queue.process('sendChatToRoom', (job) => {
		const data = job.data
		const serverTime = Date.now()

		return client.sendChatToRoom(data.sessionId, data.room, data.message, data.eventId, serverTime)
			.then((results) => {
			})
			.catch((err) => {
				_error('[Error Chat]', err)
			})
	})

	//for server controlled events
	queue.process('sendServerRoomEvent', (job, done) => {
		const data = job.data
		done(null, 'OK')
	})

	//acknowledgement that player received the server room event message
	queue.process('receivedServerRoomEvent', (job, done) => {
		const data = job.data
		done(null, 'OK')
	})


	queue.process('prepareSyncSessionData', (job) => {
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
		const serverTime 		= Date.now()

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

	queue.process('syncSessionData', (job) => {
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
					return RoomActions.getGameRoomBySessionId(sessionId)
						.then(RoomActions.commandPublishGameRoomUpdate)
				}
			})
			.then((results) => {
			})
		/*        .catch((err) => {
                    _error('[Error Sync]', err)
                    _log('err on sync '+err.toString())
                })*/
	})

	queue.process('prepareRoomEvent', (job) => {
		const data = job.data.params
		const eventId       = data.eventId
		const roomName      = data.room
		const sessionId     = data.sessionId
		const eventTable    = data.params
		const eventName        = eventTable.event
		const eventParams      = eventTable.data
		const serverTime = Date.now()

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

	queue.process('verifyRoomEvent', (job) => { //verifies an eventId for room queue processing.
		const data = job.data
		const serverTime = Date.now()

		const sessionId = data.sessionId
		const eventId   = data.eventId

		return client.verifyRoomEvent(sessionId, eventId, serverTime)
			.then((jsoned) => {
				let eventName = eventId.split('|')[1]

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

        return RoomActions.roomUpdate(data.roomName)
            .then((results) => {
                done()
            })
            .catch((err) => {
                _log('error  on roomupadte', err.toString())
                done(err.toString())
            })
    })*/

	//Turn based rooms use match logic as well as overall room events
	queue.process('sendMatchEvent', (job) => {
		const data = job.data
		const sessionId 	= data.sessionId
		const room 			= data.room
		const params 		= data.params || {}

		return client.checkSessionState(sessionId)
			.tap((result) => _log('[MATCH] Session State', result.toString()))

			//Forward event to turn based file to execute
			.then(() => turnBasedActions.processEvent(sessionId, room, params))
			.tap((result) => _log('[MATCH] Process Event', result.toString()))

			.then(() => 'OK')

			//On error, we unsubscribe user immediately TODO: switch to 3rd retry
			.tapCatch(() => {
				_log('unsubscribing')
				return queue.add('unsubscribe', {sessionId: sessionId, roomName: room}, addConfig)
			})
			.catch((err) => {
				_error('[Error Match Event]', err.status, err.message)
				console.log(err, err.stack.split("\n"))

				if(err.message === "NO SESSION"){
					//todo: fail the room
				}

				throw new Error('Match Event Error '+ err.toString())
			})
	})

	//Run a room clean up every night at 11:59 to get rooms that haven't updated in the past day (-1's are ignored)
	queue.process('expireCheck', (job, done) => {
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
                 return RoomActions.getSubscriptionsBySessionId(roomName)
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

	queue.on("global:completed", function(job){})

	//Clean up the onPlayerSub/Unsubs when many people join at the same time.
	queue.on('stalled', function(job){
		const jobId = job.jobId

		_error("job is stalled", job)
	})

	//Clean up the onPlayerSub/Unsubs when many people join at the same time.
	queue.on('error', function(job){
		const jobId = job.jobId

		if(jobId && jobId.startsWith('onPlayerSubscribe:')){

		}
		console.log('err @ roomQueue')

		console.log(job)
	})

	//Clean up the onPlayerSub/Unsubs when many people join at the same time.
	queue.on('completed', function(job){
		const jobId = job.jobId

		console.log('job @ roomSubQ')
		console.log(job)
	})
	//Clean up the onPlayerSub/Unsubs when many people join at the same time.
	queue.on('error', function(job){
		const jobId = job.jobId

		console.log('err @ roomSubQ')
		console.log(job)
	})

	queue.on('global:completed', function(jobId, result) {
		console.log(`Job ${jobId} completed! Result: ${result}`);
		queue.getJob(jobId).then(function(job) {
			job.remove();
		});
	});

	roomEvents.attach(queue)
}

//singleton
exports = module.exports = RoomEventQueue
