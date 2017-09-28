'use strict'

const fs            = require('fs')
const Promise       = require('bluebird') //https://github.com/visionmedia/debug
const debug         = require('debug') //https://github.com/visionmedia/debug
const redisManager  = require('../redis_manager')
const Bot			= require('../../_dashboard/scripts/bot-blackjack')
const globals       = require('../../globals')
const helper        = require('../../utils/helpers')
const client        = redisManager.client
const sessionQueue  = redisManager.sessionQueue
const roomSubQueue  = redisManager.roomSubQueue
const roomUpdateQueue  = redisManager.roomUpdateQueue
const _log          = debug('shared')
const _error          = debug('error')
const shared        = () => {}
/**Restored “Server/multiplayer/v2/node_modules/bull/lib/commands/moveToActive-5.lua”.
Restored “Server/multiplayer/v2/node_modules/deep-eql/node_modules”.
Restored “Server/multiplayer/v2/node_modules/deep-eql/node_modules/type-detect”.
Restored “Server/multiplayer/v2/node_modules/deep-eql/node_modules/type-detect/LICENSE”.
Restored “Server/multiplayer/v2/node_modules/deep-eql/node_modules/type-detect/index.js”.
Restored “Server/multiplayer/v2/node_modules/deep-eql/node_modules/type-detect/type-detect.js”.
Restored “Server/multiplayer/v2/node_modules/deep-eql/node_modules/type-detect/package.json”.
Restored “Server/multiplayer/v2/node_modules/deep-eql/node_modules/type-detect/README.md”.**/

const addConfig = {
	attempts: 1,
	timeout: 5000,
	removeOnComplete: true
}
const SYSTEM_ROOM_TYPE = -1
const STANDARD_ROOM_TYPE = 0
const REALTIME_ROOM_TYPE = 1
const TURNBASED_ROOM_TYPE = 2

const ERR_SESSION_DESTROYED = 1

const isNumeric = (n) => !isNaN(parseFloat(n)) && isFinite(n)
const isString = (n) => typeof n === 'string' || n instanceof String

/***
 * Get Timestamp from redis so syncs across all node servers
 */
shared.updateServerTime = () => {
	let serverTime = false
	return client.incrServerTick(1)
		.then((newServerTime) => {
			_log(newServerTime)
			serverTime = newServerTime
			globals.setVariable("SERVER_TIME", parseInt(serverTime))
			_log('[Server Time]:', serverTime)
			return serverTime
		})
		.tapCatch((err) => _error('error @ serverTime', err))
}

shared.getRoomTypeFromDb = (room) => {
	_log('find room type')
	return Promise.try(function(){ //can't use es6 for this
		return client.hexSearch('hex|rooms:properties', true, 'spo', room, 'is-room-type')
	})
	.then(function([type]){
		if(!type || !isNumeric(type)) throw new Error("no game type "+room)
		return parseInt(type)
	})
}

shared.getGameRoomBySessionId = (sessionId) => {
	let gameRoom = false //ensure that this doesn't cache
	return Promise.try(function(){ //can't use es6 for this
		return client.hexSearch('hex|sessions:rooms', true, 'spo', sessionId, 'has-gameroom-of')
	})
	.then(function([result]){
		gameRoom = result
		return (!gameRoom || !isString(gameRoom)) ? gameRoom : false
	})
}

shared.checkSessionState = (sessionId, overwriteState) => {
	let state = false //ensure that this doesn't cache
	return Promise.try(function(){ //can't use es6 for this
		const sessionKey = helper._bar('sessions', sessionId)

		//ping the db
		return client.hget(sessionKey, 'online')

	}).then(function(newState){
		_log('state is', newState)
		state = newState
		state = overwriteState ? overwriteState.toString() : state

		//check if valid state
		if(!state || !isNumeric(state) || parseInt(state) !== 1) throw new Error("SESSION OFFLINE")

		//return state
		return state
	})
}

shared.getSubscriptionsBySessionId = ([sessionId]) => {
	return new Promise((resolve, reject) => {
		let dbRoomList = []
		let roomKey, roomName
		const sessionRoomsKey = helper._bar('sessions', sessionId, 'rooms')
		const stream = client.zscanStream(sessionRoomsKey)
		const multi = client.multi()

		stream.on('data', (result) => {
			if (Array.isArray(result)) {
				for (let i = 0; i < result.length; i += 2) {
					roomName = result[i]
					roomKey = helper._bar('rooms', roomName, 'info')
					dbRoomList.push(roomName)
					multi.hget(roomKey, 'roomTypeId')
				}
			}
		})

		stream.on('end', () => {
			multi.exec()
				.map(([err, roomType], index) => [parseInt(roomType), dbRoomList[index]])
				.then((activeRoomList) => {
					resolve(activeRoomList);
				})
				.catch(reject)
		})

		stream.on('error', reject)
	})
}
shared.removeBotFromRoom = (roomName) => {
	const roomBotKey = helper._bar('rooms',roomName,'bots')
	return client.srandmember(roomBotKey)
		.then((sessionId) => {
			if(!sessionId){ return true }

			const sessionRoom = helper._colon('session', sessionId)
			const redisRoomName = helper._bar('bot', sessionId)
			const serverTime = globals.getVariable("SERVER_TIME")

			//send a message to the bot to d/c it.
			const message = JSON.stringify({
				sessionId: sessionId,
				phase: "requestDisconnect",
				room: sessionRoom,
				response: {
					sessionId: sessionId,
					room: roomName,
					time: serverTime
				}
			})
			return client.publish(redisRoomName, message)
		})
}

shared.removeAllBotsFromRoom = (roomName) => {
	const roomBotKey = helper._bar('rooms',roomName,'bots')

	return client.smembers(roomBotKey)
		.map((sessionId) => {
			if(!sessionId){ return true }
			const sessionRoom = helper._colon('session', sessionId)
			const redisRoomName = helper._bar('bot', sessionId)
			const serverTime = globals.getVariable("SERVER_TIME")

			//send a message to the bot to d/c it.
			const message = JSON.stringify({
				sessionId: sessionId,
				phase: "requestDisconnect",
				room: sessionRoom,
				response: {
					sessionId: sessionId,
					room: roomName,
					time: serverTime
				}
			})
			return client.publish(redisRoomName, message)
	})
		.then((results) =>{
			_log('result from remove all bots', results)
			return true
		})
}

shared.addBotToRoom = (roomName, roomType) => {
	return new Promise((resolve, reject) => {
		let params = {}
		switch(roomType){
			case -1:
				params.isSystem = true
				break
			case 1:
			case 2:
				params.isGameRoom = true
				params.isTurnBased = roomType === 2
				break
		}

		if(new Bot(roomName, params)){
			resolve()
		} else {
			reject()
		}
	})
}

shared.checkIfBot = (sessionId) => {
	const sessionKey = helper._bar('sessions', sessionId)
	return client.hexists(sessionKey, 'bot')
		.then((result) => result === 1)
}


shared.getSubscriptionsAndSeatsIndexByRoom = ([roomName]) => {
    return new Promise((resolve, reject) => {
        let dbRoomList = []
		let str,seatIndex,sessionId
        const dbRoomKey = helper._bar('rooms', roomName)
		const stream = client.zscanStream(dbRoomKey, {
			match: 'taken:seat:[1-9]*:*'
		})
        stream.on('data', (result) => {
            if (Array.isArray(result)) {
                for (let i = 0; i < result.length; i += 2) {
                    //returns player [seat index, session id]
					if([str, seatIndex, sessionId] = result[i].match('^taken:seat:(\\d+):(.*)$')){
						dbRoomList.push([parseInt(seatIndex), sessionId])
					}
                }
            }
        })

        stream.on('end', () => { resolve(dbRoomList) })
        stream.on('error', reject)
    })
}

shared.getSubscriptionsByRoom = ([roomName]) => {
    return new Promise((resolve, reject) => {
        let dbRoomList = []
		let str,seatIndex,sessionId
		const dbRoomKey = helper._bar('rooms', roomName)
        const roomInfoKey = helper._bar('rooms', roomName, 'info')
        let roomType

        client.hget(roomInfoKey, 'typeIndex')
            .then((roomTypeValue) => {
                roomType = roomTypeValue

                const stream = client.zscanStream(dbRoomKey)

                stream.on('data', (result) => {
                    if (Array.isArray(result)) {
                        for (let i = 0; i < result.length; i += 2) {
							//returns player [seat index, session id]
							if([str, seatIndex, sessionId] = result[i].match('^taken:seat:(\\d+):(.*)$')){
								dbRoomList.push([roomType, sessionId])
							}
                        }
                    }
                })

                stream.on('end', () => {
                    resolve(dbRoomList)
                })
                stream.on('error', reject)

            }).catch(reject)
    })
}

shared.filterMultipleGameRooms = ([sessionId, roomList]) => {
	let hasGameRoom
	//reverse the array to ensure the latest gameroom is used
	const revRoomList = roomList.reverse()
	return Promise.filter(revRoomList, ([type,_]) => {

		if(isGameRoom(type)){
			if(!hasGameRoom) {
				hasGameRoom = true
				return true
			}
			return false //remove duplicate game rooms
		}
		return true
	}).then((filteredRoomList) =>
		//reverse back
		[sessionId, filteredRoomList.reverse()]
	)
}

shared.filterReservations = ([sessionId, roomList]) => {
	return Promise.filter(roomList, ([type,room]) => {

		//Check if valid room and type
		if(!(isNumeric(type)) || !room) return false //remove from array

		const reservesKey = helper._bar('rooms',room, 'reserves')
		const serverTime = globals.getVariable("SERVER_TIME")

		switch (type) {
			case SYSTEM_ROOM_TYPE:
			case STANDARD_ROOM_TYPE:
				return true //keep in array
			case REALTIME_ROOM_TYPE:
			case TURNBASED_ROOM_TYPE:
				//keep in array
				return client.zscore(reservesKey, sessionId).then((timeExpired) => isNumeric(timeExpired) ? timeExpired > serverTime : false)
			default:
				return false //remove from array
		}
	})
	.then((filteredRoomList) => [sessionId, filteredRoomList])
}

shared.filterExistingSubs = ([sessionId, roomList])  => {
	return shared.getSubscriptionsBySessionId([sessionId])
		.then((existingSubs) => {

			const subList = helper._flatten(existingSubs)
			if(subList.length > 0){
				return Promise.filter(roomList, ([type,room]) => !subList || !subList.includes(room))
					.then((filteredList) => [sessionId, filteredList])
			} else {
				return [sessionId, roomList]
			}
		})
}

shared.checkNonExistingSubsAndType = ([sessionId, roomList, removeEmptyRooms])  => {
	//uses the array from the db, as it has the type already defined.
	return shared.getSubscriptionsBySessionId([sessionId])
		.filter(([roomType, roomName]) => roomList.includes(roomName))
		.then((filteredList) => [sessionId, filteredList, removeEmptyRooms])
}


shared.getPlayersDataFromGameRoom = (roomName, options = {}) => {

    const getPlayersData = new Promise((resolve, reject) => {
    	let seatToSession = []
		const dbRoomKey = helper._bar('rooms', roomName)
        const stream = client.zscanStream(dbRoomKey, {
        	match: 'taken:seat:[1-9]*:*'
		})
        let str, sessionId, dbSessionKey, seatIndex
        let multi = client.multi()


        stream.on('data', (result) => {

            if (Array.isArray(result)) {
                for (let i = 0; i < result.length; i += 2) {
					//returns player [seat index, session id]
					if([str, seatIndex, sessionId] = result[i].match('^taken:seat:(\\d+):(.*)$')){
						if(sessionId && seatIndex > 0){
							dbSessionKey = helper._bar('sessions', sessionId)
							multi.hgetall(dbSessionKey)
							seatToSession.push([seatIndex, sessionId])
						}
					}
                }
            }
        })

        stream.on('end', () => {

			const findSeatIndex = (sessionIdSearch) => {
				let value = seatToSession.find(([seatIndex, sessionId]) => sessionId === sessionIdSearch)
				return value ? value[0] : 0
			}

			multi.exec()
                .filter(([err, playerData]) => {
					if(playerData && playerData.sessionId){
                        return !(options.skipSessionId && playerData.sessionId === options.skipSessionId)
                    }
                    return false
                })
                .map(([err, playerData]) => {
					playerData.seatIndex = findSeatIndex(playerData.sessionId)
					return playerData
				}) //only get the data (not the err message)
                .then(resolve)
                .catch((err) => {
					_log('err on player data from game room', err.toString())
                    return reject(err.toString())
                })
        })

        stream.on('error', (err) => {
			multi.discard()
            return reject(err.toString())
        })
    })

    const roomType = new Promise((resolve, reject) => {
        if(options.roomType) {
            return resolve(options.roomType)
        }
        return shared.getRoomTypeFromDb(roomName).then(resolve).catch(reject)
    })


    return Promise.props({
        roomType: roomType,
        playersData: getPlayersData
    })
        .then((props) => {
            switch(props.roomType){
                case TURNBASED_ROOM_TYPE:
                	//_log('turn based', props.playersData)
                    //let formatted = props.playersData.filter((player) => player.seatIndex) //only return those who have a seat number
                    //return formatted.sort((a,b) => b.seatIndex-a.seatIndex) //rearrange by seat number


                case REALTIME_ROOM_TYPE:
                default:
                    return props.playersData //return the formatted array
            }
        })
}

shared.getThemeCounts = (roomPath) => {
    return new Promise((resolve, reject) => {
        const dbRoomKey = helper._bar('counts', roomPath)
        const dbThemeCounts = {}
        const stream = client.zscanStream(dbRoomKey)

        stream.on('data', (result) => {

            if (Array.isArray(result)) {
                for (let i = 0; i < result.length; i += 2) {
                    dbThemeCounts[result[i]] = parseInt(result[i+1])
                }
            }
        })

        stream.on('end', () => {
            resolve(dbThemeCounts)
        })

        stream.on('error', (err) => {
            return reject(err.toString())
        })
    })
}


/**
 * Room utility functions
*/

const isGameRoom = (id) => {
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

/** Handlers/Hooks for room queue, so everything is in one place.
/* handleFUNCTIONNAME
*/

shared.roomUpdate = (roomName, type) => {
    let roomType = type
    let roomArr = JSON.stringify(helper._roomNameToArr(roomName))

	return new Promise((resolve, reject) => {
		roomType = type ? type : shared.getRoomTypeFromDb(roomName).catch(false)
		Promise.props({type: roomType})
			.then((props) => {
				roomType = props.type
				switch (roomType) {
					case SYSTEM_ROOM_TYPE:
					case STANDARD_ROOM_TYPE:
						resolve()
						break
					case REALTIME_ROOM_TYPE:
					case TURNBASED_ROOM_TYPE:
						if (roomArr.roomTheme === "lobby") {
							return shared.commandPublishGameRoomLobbyUpdate(roomName, roomType)
						}
						return shared.commandPublishGameRoomUpdate(roomName, roomType)
					default:
						_log('no type defined', roomType)
						reject('No room type was found or defined')
						break
				}
			})
			.then((response) => resolve(response))
			.tapCatch(_error)
			.catch((err) => reject(err.toString()))
	})
}

shared.handleVerifyRoomEvent = (data) => {

}

shared.getBotsEnabledInRoom = (roomArr) => {
	const serverConfig 	= globals.getVariable("SERVER_CONFIG")
	const botEnabledRoomConfig	= serverConfig['botEnabledRooms']
	let isBotEnabledRoom = botEnabledRoomConfig["default"]
	if(botEnabledRoomConfig[roomArr['roomGame']]){
		isBotEnabledRoom = botEnabledRoomConfig[roomArr['roomGame']]
	}

	if(botEnabledRoomConfig[roomArr['roomGameThemeName']]){
		isBotEnabledRoom = botEnabledRoomConfig[roomArr['roomGameThemeName']]
	}
	return isBotEnabledRoom
}

shared.getMaxSubscriptions = (roomArr) => {
	const serverConfig 	= globals.getVariable("SERVER_CONFIG")
	const maxSubscribersConfig	= serverConfig['maxSubscribersPerRoom']
	let maxSubscriptions = maxSubscribersConfig['default']

	if(maxSubscribersConfig[roomArr.roomGame]){
		maxSubscriptions = maxSubscribersConfig[roomArr['roomGame']]
	}
	return maxSubscriptions || 0
}

shared.getMaxObservers = (roomArr) => {
	const serverConfig 	= globals.getVariable("SERVER_CONFIG")
	const maxObserversConfig	= serverConfig['maxObserversPerRoom']
	let maxObservers 			= maxObserversConfig['default']

	if(maxObserversConfig[roomArr['roomGame']]){
		maxObservers = maxObserversConfig[roomArr['roomGame']]
	}

	return maxObservers || 0
}

shared.setupRooms = ([sessionId, roomList]) => {

	return Promise.try(function() { //can't use es6 for this
		let multi = client.multi()
		let setupList = []
		let subList = []

		//Setup multi
		for (let [_,room] of roomList) {
			multi.zscore('tick|rooms', room)
		}

		return multi.exec()
			.tap(([err, result]) => {
				_error('setup results', err, result);
				multi = client.multi()
			})
			//return room name as part of this list
			.each(([err, result], index) => {
				const roomExists = isNumeric(result)
				const roomArr = roomList[index]
				const [type, room] = roomArr
				if(roomExists){
					return subList.push(roomArr)
				} else {
					setupList.push(roomArr)
					return shared.setupRoom(sessionId, room, type, multi)
				}
			})
			.then(() => {
				if(setupList.length > 0){
					return multi.exec()
				} else {
					multi.discard()
					return []
				}
			})
			.each(([err, setupResult], index) => {
				_error('n setup', err, setupResult, setupList[index]);
				//verify the result
				if(err || !setupResult){ return false }
				subList.push(setupList[index])
			})
			.tapCatch((err)=> { _error('error on setup', err); multi.discard()})
			.then(() => {
				return [sessionId, subList]
			})
	})

}

shared.subToRooms = ([sessionId, roomList]) => {
	let multi = client.multi()
	let subList = []

	if(roomList.length <= 0) return Promise.resolve([sessionId, []])

	for (let [_, room] of roomList) {
		multi.zscore('tick|rooms', room)
	}

	return multi.exec()
		.tap(() => {multi = client.multi()})
		//return room name as part of this list
	//TODO: add expire check
		.each(([err, result], index) => {
			const roomExists = isNumeric(result) ? roomList[index] : null
			const roomArr = roomList[index]
			const [type, room, params] = roomArr
			if(roomExists) {
				subList.push(roomArr)
				return shared.subToRoom(sessionId, room, type, params, multi)
			}
		})
		.then(() => {
			if(subList.length > 0){
				return multi.exec()
			} else {
				multi.discard()
				return []
			}
		})
		.each(([err, subResult], index) => {
			const roomArr = subList[index]
			const [type, room] = roomArr
			return shared.setupOnSubscribeJob(sessionId, room, type)

		})
		.tapCatch(_error)
		.tapCatch(() => multi.discard())
		//todo: add filter
		.then(() => {
			return [sessionId, subList]
		})
}

shared.setupOnSubscribeJob = (sessionId, room, type) => {
	const jobId = helper._colon('onPlayerSubscribe', room)
	return Promise.props({
		id: jobId,
		sessionId: sessionId,
		roomName: room,
		roomType: type,
		bot: shared.checkIfBot(sessionId)
	})
	.then(function(dataToSend){
		return roomSubQueue.add('onPlayerSubscribe', dataToSend, {jobId: dataToSend.jobId, ...addConfig})
	})
	.then(function(nestedJob){ return nestedJob.finished()})
	.then(function(result) {
		return result
	})
	.tapCatch(_error)
}

shared.getReservationCount = (roomName) => {
	let numReservations = 0 //ensure that this doesn't cache
	let roomKey = helper._bar('rooms', roomName, 'reserves')
	return Promise.try(function(){ //can't use es6 for this
		return client.zcard(roomKey)
	}).then(function(result){
		numReservations = result //store result so we can nil
		return numReservations
	})
	.tapCatch(_error)

}

shared.unSubFromRooms = ([sessionId, roomList, removeEmptyRooms = true]) => {
	let multi = client.multi()
	let destroyList = []

	if(roomList.length <= 0) return Promise.resolve([sessionId, [], removeEmptyRooms])


	return Promise.each(roomList, ([type,room]) =>
			shared.unsubToRoom(sessionId, room, type, {}, multi)
		)
		.tap((list) => { _error('list', list); _error('roomlist', roomList)})
		.then(() => multi.exec())
		.tap(() => {multi = client.multi()})
		.each(([err, unSubResult], index) => {

			const [type, room] = roomList[index]

			if(!err && unSubResult > 0){
				return shared.setupOnUnSubscribeJob(sessionId, room, type)
			} else if(!err && unSubResult <= 0 && removeEmptyRooms){
				return shared.getReservationCount(room)
					.then((numReserves) => {

						if(numReserves === 0){
							destroyList.push(roomList[index])
							return shared.destroyRoom(type, room, multi)
						}
					})
			} else {
				return 'OK'
			}
		})
		.then(() => {
			if(destroyList.length > 0){
				return multi.exec()
			} else {
				multi.discard()
				return []
			}
		})
		.tapCatch(()=> {multi.discard()})
		.tap((result) => {_error('results', result)})
		.then((results) => {
			return [sessionId, roomList, removeEmptyRooms]
		})

}

shared.setupOnUnSubscribeJob = (sessionId, room, type) => {
	const jobId = helper._colon('onPlayerUnSubscribe', room)
	return Promise.props({
		id: jobId,
		sessionId: sessionId,
		roomName: room,
		roomType: type,
		bot: shared.checkIfBot(sessionId)
	})
		.then(function(dataToSend){
			return roomSubQueue.add('onPlayerUnSubscribe', dataToSend, {jobId: dataToSend.jobId, ...addConfig})
		})
		.then(function(nestedJob){ return nestedJob.finished()})
		.then(function(result) {
			return result
		})
		.tapCatch(_error)
}

/**
 * Main router function when user wants to join a room
 * @param creator
 * @param type
 * @param room
 * @param redisClient default client or multi client
 * @returns {Promise}
 */
shared.setupRoom = (creator = "server", room, type, redisClient = client) => {

    let roomArr 			= helper._roomNameToArr(room)
    let roomArrStr 			= JSON.stringify(roomArr)
    let maxObservers 		= shared.getMaxObservers(roomArr)
    let isBotEnabledRoom 	= shared.getBotsEnabledInRoom(roomArr)
    let maxSubscriptions 	= shared.getMaxSubscriptions(roomArr)

	return Promise.resolve().then(() => {
		switch (type) {
			case SYSTEM_ROOM_TYPE:
				_log('max users for system room', maxSubscriptions)
				return redisClient.setupSystemRoom(creator, room, isBotEnabledRoom, 'LIMIT', maxSubscriptions, maxObservers)
			case STANDARD_ROOM_TYPE:
				_log('max users for std room', maxSubscriptions)
				return redisClient.setupStandardRoom(creator, room, isBotEnabledRoom, 'LIMIT', maxSubscriptions, maxObservers)
			case REALTIME_ROOM_TYPE:
				return redisClient.setupRealTimeGameRoom(creator, room, roomArrStr, isBotEnabledRoom, 'LIMIT', maxSubscriptions, maxObservers)
			case TURNBASED_ROOM_TYPE:
				return redisClient.setupTurnBasedGameRoom(creator, room, roomArrStr, isBotEnabledRoom, 'LIMIT', maxSubscriptions, maxObservers)
			default:
				_log('no type defined for setup', type, room)
				throw new Error('No room type was found or defined')
		}
	})
}

shared.subToRoom = (sessionId, roomName, type, appendResponse = {}, redisClient=client) => {
    const roomType = type ? type: shared.getRoomTypeFromDb(roomName)
    const roomArr = JSON.stringify(helper._roomNameToArr(roomName))
	return Promise.resolve()
        .then(() => {
			const serverTime = globals.getVariable("SERVER_TIME")
			let strAppendResponse = JSON.stringify(appendResponse)

            switch (roomType) {
                case SYSTEM_ROOM_TYPE:
                    return redisClient.subSystemRoom(sessionId, roomName, serverTime, strAppendResponse)
                case STANDARD_ROOM_TYPE:
                    return redisClient.subStandardRoom(sessionId, roomName, serverTime, strAppendResponse)
                case REALTIME_ROOM_TYPE:
                    return redisClient.subRealTimeGameRoom(sessionId, roomName, roomArr, serverTime, strAppendResponse)
                case TURNBASED_ROOM_TYPE:
                    return redisClient.subTurnBasedGameRoom(sessionId, roomName, roomArr, serverTime, strAppendResponse)
                default:
                    _log('no type defined', roomType)
                    throw new Error('No room type was found or defined')
                    break
            }
        }).tapCatch(_error)

}

shared.unsubToRoom = (sessionId, roomName, type, appendResponse = {}, redisClient=client) => {

	_log('unsub', sessionId, roomName, type, appendResponse)
	const roomType = type ? type : shared.getRoomTypeFromDb(roomName)
	const roomArr = JSON.stringify(helper._roomNameToArr(roomName))
	const strAppendResponse = JSON.stringify(appendResponse)

	return Promise.props({sessionId, roomName, roomType, roomArr, strAppendResponse})
        .then((props) => {
			const serverTime = globals.getVariable("SERVER_TIME")
			switch (props.roomType) {
                case SYSTEM_ROOM_TYPE:
                    return redisClient.unsubSystemRoom(props.sessionId, props.roomName, serverTime, props.strAppendResponse)
                case STANDARD_ROOM_TYPE:
                    return redisClient.unsubStandardRoom(props.sessionId, props.roomName, serverTime, props.strAppendResponse)
                case REALTIME_ROOM_TYPE:
                    return redisClient.unsubRealTimeGameRoom(props.sessionId, props.roomName, props.roomArr, serverTime, props.strAppendResponse)
                case TURNBASED_ROOM_TYPE:
                    return redisClient.unsubTurnBasedGameRoom(props.sessionId, props.roomName, props.roomArr, serverTime, props.strAppendResponse)
                default:
                    throw new Error('[Unsub]: No room type was found or defined')
            }
		}).tapCatch(_error)
}

shared.findAndDestroyRoom = (roomName, redisClient=client) => {
	_log('in find destory')

	const roomType = shared.getRoomTypeFromDb(roomName)
	_log('in find destory promise')

	return Promise.props({roomName, roomType})
		.then((props) => {
			_log('in destroy now with type', props.roomName, props.roomType)

			return shared.getReservationCount(roomName)
				.then((numReserves) => {
					if(numReserves === 0){
						_log('in destroy now with type', props.roomName, props.roomType)
						return shared.destroyRoom(props.roomType, props.roomName)
					}
				})

		})
		.then((destroyResults) => {
			_log('destroy Restrulsts', destroyResults)
		}).tapCatch(_error)
}


shared.destroyRoom = (type, roomName, redisClient=client) => {
    let roomArr = JSON.stringify(helper._roomNameToArr(roomName))

	return Promise.resolve()
		.then(() => {
			const serverTime = globals.getVariable("SERVER_TIME")
			_log('destroy room status: ', type, roomName)
			switch (type) {
				case SYSTEM_ROOM_TYPE:
					return redisClient.destroySystemRoom(roomName, serverTime)
				case STANDARD_ROOM_TYPE:
					return redisClient.destroyStandardRoom(roomName, serverTime)
				case REALTIME_ROOM_TYPE:
					return redisClient.destroyRealTimeGameRoom(roomName, roomArr, serverTime)
				case TURNBASED_ROOM_TYPE:
					return redisClient.destroyTurnBasedGameRoom(roomName, roomArr, serverTime)
				default:
					throw new Error('[Destroy]: No room type was found or defined')
					break
			}
   }).tapCatch(_error)

}

//Queue cleanup scripts
shared.removePlayerOnSubOrUnSubNotifications = (roomName) =>{
	const jobIdSub = helper._colon('onPlayerSubscribe', roomName)
	const jobIdUnSub = helper._colon('onPlayerUnSubscribe', roomName)

	const unsub = jobIdSub ? roomUpdateQueue.getJob(jobIdUnSub).then((job) => job.promote()).tapCatch(_error).catch((err) => false) : false
	const sub 	= jobIdUnSub ? roomUpdateQueue.getJob(jobIdSub).then((job) => job.promote()).tapCatch(_error).catch((err) => false) : false
	return Promise.all([sub, unsub])
}

/** Link lua scripts to commands **/

//Custom redis command but in node
shared.commandPublishGameRoomUpdate = (roomName, roomType) => {
	const roomInfoKey = helper._bar('rooms', roomName, 'info')

	return Promise.props({
		phase: "roomUpdate",
		room: roomName,
		messageIndex: client.hincr(roomInfoKey, 'updateIndex', 1).then(([err,newIndex]) => newIndex),
		response: {
			players: shared.getPlayersDataFromGameRoom(roomName, {roomType: roomType}),
			room: roomName
		}
	})
	.then((dataToSend) => {
		let message = JSON.stringify(dataToSend)
		return client.publishToRoom(roomName, message)
	})
	.tapCatch(_error)
}

shared.commandPublishGameRoomLobbyUpdate = (roomPath, roomName) => {
	return shared.getThemeCounts(roomPath, roomName)
        .then((playersData) => {
			let dataToSend = {
                phase: "roomUpdate",
                room: roomName,
                response: {
                    counts: playersData,
                    room: roomName,
                    roomPath: roomPath //v2
                }
            }
            let message = JSON.stringify(dataToSend)
            return client.publishToRoom(roomName, message)
        })
		.tapCatch(_error)
}

shared.checkForGameRoomsAndUnSub = ([sessionId, roomList]) => {

	let hasGameRoom
	for (let [type,room] of roomList) {
		if(isGameRoom(type) && !hasGameRoom){
			hasGameRoom = room
			break
		}
		if(hasGameRoom) break
	}

	if(hasGameRoom){
		return shared.getGameRoomBySessionId(sessionId)
			.then((room) => {
				if (room && room === hasGameRoom) {
					//don't destroy the room as we are reconnecting to it (probably with a different session id)
					return roomSubQueue.add('unsubscribe', {sessionId: sessionId, roomName: room, removeEmptyRooms: false}, {...addConfig})
				} else {
					return roomSubQueue.add('unsubscribe', {sessionId: sessionId, roomName: room}, {...addConfig})
				}
			})
			.then((nestedJob) => nestedJob.finished())
			.then((result) =>{
				return [sessionId, roomList]
			})
			.tapCatch(_error)
			.catch((err)=> {
				if(err.message === "no game room"){
					return [sessionId, roomList]
				}
			})
	} else {
		return [sessionId, roomList]
	}
}


shared.commandRoomTick = (job) => {

		const checkExpires = () => {
			const serverTime = globals.getVariable("SERVER_TIME")

			_log('check expiresss', serverTime)

			const expiredTime = 60000 //60 sec expiration without an update
			let roomList = []
			let multi
			//move expired ones to another table for processing
			return client.zrangebyscore('tick|rooms', '(0', serverTime-expiredTime, 'LIMIT', 0, 25)
				.tap((rooms)=> {
					_log('rooms found', rooms)
					multi = client.multi()
				})
				.each((roomName) => {
				_log('map series for ', roomName)
					multi.zadd('expires|rooms', 0, roomName)
					//get all sessions in the room w/ roomType
					return Promise.resolve(shared.findAndDestroyRoom(roomName)).tapCatch((err) => {
						_error('err @ tick', err)
					})
				})
				.tap(() => {
					_log('after map series')
					if(roomList.length > 0){
						return multi.exec()
					} else {
						multi.discard()
						return []
					}
				})
				.then((result) => {
					_log('whats here', result)
					_log('whats here2', roomList)
				})
				.tapCatch((err) => {
					_error('err @ tick', err)
				})

			/*
                    //process the rooms that need a tick
                    return new Promise((resolve, reject) => {
                        let dbRoomList = []
                        let roomKey, roomName
                        const roomsListKey = helper._bar('tick', 'rooms')
                        const stream = client.zscanStream(roomsListKey)
                        const multi = client.multi()

                        stream.on('data', (result) => {
                            if (Array.isArray(result)) {
                                for (let i = 0; i < result.length; i += 2) {
                                    roomName = result[i]
                                    roomKey = helper._bar('rooms', roomName, 'info')
                                    dbRoomList.push(roomName)
                                    multi.hget(roomKey, 'roomTypeId')
                                }
                            }
                        })

                        stream.on('end', () => {
                            multi.exec()
                                .map(([err, roomType], index) => [parseInt(roomType), dbRoomList[index]])
                                .then((activeRoomList) => {
                                    resolve(activeRoomList);
                                })
                                .catch(reject)
                        })

                        stream.on('error', reject)
                    })*/
		}

		const checkRoomStates = () => {
			_log('check expi1resss')
			const serverTime = globals.getVariable("SERVER_TIME")

			let roomList = []
			return client.zrangebyscore('tick|rooms', '(0', serverTime-2000, 'LIMIT', 0, 25)
				.tap((rooms)=> {
					_log('rooms found', rooms)
				})
				.each((roomName) => {
					const roomInfoKey = helper._bar('rooms', roomName, 'info')
					return client.hmget(roomInfoKey, 'gameState', 'subscribers').then(([gameState,subscribers]) => {
						if(gameState){
							roomList.push(roomName, gameState)
							const newExpire = serverTime+5000
							const newTime = serverTime

							if(gameState === 'CREATED' && parseInt(subscribers) > 1){

								return client.setGameActive(roomName, newTime)

							} else if(gameState === 'ACTIVE' && parseInt(subscribers) > 1){
								return client.checkCurrentTurn(roomName, newTime)
									.tap(_error).then((result) => result === "EXPIRED" ? client.setNextTurn(roomName, newTime) : result)
							}
						} else {
							return 'OK'
						}
					})
				})
				.tap(() => {

				})
				.then((result) => {
					_log('whats state', roomList, result)
					return roomList
				})
				.tapCatch((err) => {
					_error('err @ tick', err)
				})
		}

		const checkRoomUpdates = () => {
			_log('check expi2resss')

			return 'done too'
			/*//process the rooms that need a tick
            return new Promise((resolve, reject) => {
                let dbRoomList = []
                let roomKey, roomName
                const roomsListKey = helper._bar('tick', 'rooms')
                const stream = client.zscanStream(roomsListKey)
                const multi = client.multi()

                stream.on('data', (result) => {
                    if (Array.isArray(result)) {
                        for (let i = 0; i < result.length; i += 2) {
                            roomName = result[i]
                            roomKey = helper._bar('rooms', roomName, 'info')
                            dbRoomList.push(roomName)
                            multi.hget(roomKey, 'roomTypeId')
                        }
                    }
                })

                stream.on('end', () => {
                    multi.exec()
                        .map(([err, roomType], index) => [parseInt(roomType), dbRoomList[index]])
                        .then((activeRoomList) => {
                            resolve(activeRoomList);
                        })
                        .catch(reject)
                })

                stream.on('error', reject)
            })*/
		}

		return Promise.all([checkExpires(),checkRoomStates(),checkRoomUpdates()])
/*


	return client.multi().zrangebyscore('tick|rooms', '(0', Date.now(), 'LIMIT', 0, 10).exec()
		.tap(_error)
		.then(([err,results]) => results)
		.each((roomName) => {
			_log('[Update Room]: ' + roomName)
			return roomActions.getRoomTypeFromDb(roomName)
				.then((roomType) => {
					switch(roomType){
						case REALTIME_ROOM_TYPE:
							return roomUpdateQueue.add("roomUpdate", {roomName: roomName, roomType:roomType}, addConfig).then((nestedJobResult) => roomType)
					}
					return roomType
				}).then(() => {
					return 'OK'
				}).catch((err) => {
					_log('[ERR @ roomTick]' + err.toString())
					return 'OK'
				})
		})
		.then((results) => {
			return 'OK'
		})
		.catch((err) => {
			_log('[ERR @ roomTick]' + err.toString())
		})*/
}

shared.commandUnSubSession = (sessionId, destroyType) => {
	return shared.getSubscriptionsBySessionId([sessionId])
		.then((roomList) => shared.unSubFromRooms([sessionId, roomList]))
		.then(() => client.destroySession(sessionId, destroyType))
		.tapCatch(_error)

}

client.defineCommand('destroySession', {
	numberOfKeys: 1,
	lua: fs.readFileSync("./scripts/redis/destroySession.lua", "utf8")
})

client.defineCommand('verifyRoomEvent', {
    numberOfKeys: 3,
    lua: fs.readFileSync("./scripts/redis/verifyRoomEvent.lua", "utf8")
})
client.defineCommand('getRandBotSessionFromRoom', {
    numberOfKeys: 1,
    lua: fs.readFileSync("./scripts/redis/getRandBotSessionFromRoom.lua", "utf8")
})


client.defineCommand('sendChatToRoom', {
    numberOfKeys: 5,
    lua: fs.readFileSync("./scripts/events/sendChatToRoom.lua", "utf8")
})

//System Reserved Rooms (type -1)
client.defineCommand('setupSystemRoom', {
    numberOfKeys: 4,
    lua: fs.readFileSync("./scripts/redis/setupSystemRoom.lua", "utf8")
})
client.defineCommand('subSystemRoom', {
    numberOfKeys: 3,
    lua: fs.readFileSync("./scripts/redis/subSystemRoom.lua", "utf8")
})
client.defineCommand('unsubSystemRoom', {
    numberOfKeys: 3,
    lua: fs.readFileSync("./scripts/redis/unsubSystemRoom.lua", "utf8")
})
client.defineCommand('destroySystemRoom', {
    numberOfKeys: 1,
    lua: fs.readFileSync("./scripts/redis/destroySystemRoom.lua", "utf8")
})

//Standard Rooms (type 0)
client.defineCommand('setupStandardRoom', {
    numberOfKeys: 4,
    lua: fs.readFileSync("./scripts/redis/setupStandardRoom.lua", "utf8")
})
client.defineCommand('subStandardRoom', {
    numberOfKeys: 3,
    lua: fs.readFileSync("./scripts/redis/subStandardRoom.lua", "utf8")
})
client.defineCommand('unsubStandardRoom', {
    numberOfKeys: 3,
    lua: fs.readFileSync("./scripts/redis/unsubStandardRoom.lua", "utf8")
})
client.defineCommand('destroyStandardRoom', {
    numberOfKeys: 1,
    lua: fs.readFileSync("./scripts/redis/destroyStandardRoom.lua", "utf8")
})

//Real time rooms (type 1)
client.defineCommand('setupRealTimeGameRoom', {
    numberOfKeys: 5,
    lua: fs.readFileSync("./scripts/redis/setupRealTimeGameRoom.lua", "utf8")
})
client.defineCommand('subRealTimeGameRoom', {
    numberOfKeys: 4,
    lua: fs.readFileSync("./scripts/redis/subRealTimeGameRoom.lua", "utf8")
})
client.defineCommand('unsubRealTimeGameRoom', {
    numberOfKeys: 4,
    lua: fs.readFileSync("./scripts/redis/unsubRealTimeGameRoom.lua", "utf8")
})
client.defineCommand('destroyRealTimeGameRoom', {
    numberOfKeys: 2,
    lua: fs.readFileSync("./scripts/redis/destroyRealTimeGameRoom.lua", "utf8")
})

//Turn based rooms (type 2)
client.defineCommand('setupTurnBasedGameRoom', {
    numberOfKeys: 5,
    lua: fs.readFileSync("./scripts/redis/setupTurnBasedGameRoom.lua", "utf8")
})
client.defineCommand('subTurnBasedGameRoom', {
    numberOfKeys: 4,
    lua: fs.readFileSync("./scripts/redis/subTurnBasedGameRoom.lua", "utf8")
})
client.defineCommand('unsubTurnBasedGameRoom', {
    numberOfKeys: 4,
    lua: fs.readFileSync("./scripts/redis/unsubTurnBasedGameRoom.lua", "utf8")
})
client.defineCommand('destroyTurnBasedGameRoom', {
    numberOfKeys: 2,
    lua: fs.readFileSync("./scripts/redis/destroyTurnBasedGameRoom.lua", "utf8")
})
client.defineCommand('setGameActive', {
	numberOfKeys: 2,
	lua: fs.readFileSync("./scripts/redis/turnbased/setGameActive.lua", "utf8")
})
client.defineCommand('checkCurrentTurn', {
	numberOfKeys: 2,
	lua: fs.readFileSync("./scripts/redis/turnbased/checkCurrentTurn.lua", "utf8")
})
client.defineCommand('setNextTurn', {
	numberOfKeys: 2,
	lua: fs.readFileSync("./scripts/redis/turnbased/setNextTurn.lua", "utf8")
})
module.exports = shared
