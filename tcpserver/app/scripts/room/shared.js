"use strict"
const debug = require('debug') //https://github.com/visionmedia/debug
const _log = debug('shared')
const _error = debug('shared:err')

const {
	SYSTEM_ROOM_TYPE,
	TURNBASED_ROOM_TYPE,
	REALTIME_ROOM_TYPE,
	STANDARD_ROOM_TYPE
} = require('../constants')

const uuidv4 = require('uuid/v4')
const _ = require('lodash')
const _flatten = require('lodash/flatten')
const Promise = require('bluebird') //https://github.com/visionmedia/debug

const roomNameToArr = require('../../util/roomNameToArr')

const store = require('../../store')
const db = store.database

const getRoomTypeFromParams = require('../../util/getRoomTypeFromParams')

const shared = () => {}

//todo: convert time expansive functions to c++ variation
const addConfig = {
	attempts: 1,
	timeout: 5000,
	removeOnComplete: false,
}

const isNumeric = (n) => !isNaN(parseFloat(n)) && isFinite(n)
const isString = (n) => typeof n === 'string' || n instanceof String

const _isEqual = require('lodash/isEqual')
const _get = require('lodash/get')
const _has = require('lodash/has')
const _join = require('lodash/join')

const isGameRoomByType = require('../../util/isGameRoomByType')

/***
 * Get Timestamp from redis so syncs across all node servers
 */
shared.updateServerTime = () => {
	let serverTime = Date.now()
	return db.call('set', ['serverTime', serverTime])
		.then(() => {
			_log('[Server Time]:', serverTime, Date.now())
			return serverTime
		})
		.tapCatch((err) => _error('error @ serverTime', err))
}

shared.getTime = () => {
	return Date.now()
}

shared.getRoomTypeFromDb = (room) => {
	return Promise.try(function () { //can't use es6 for this
			return db.call('hexSearch', ['hex|rooms:properties', true, 'spo', room, 'is-room-type'])
		})
		.then(function ([type]) {
			if (!type || !isNumeric(type)) throw new Error('NO ROOM TYPE')
			return parseInt(type)
		})
}

shared.getGameRoomBySessionId = (sessionId) => {
	let gameRoom = false //ensure that this doesn't cache
	return Promise.try(function () { //can't use es6 for this
			return db.call('hexSearch', ['hex|sessions:rooms', true, 'spo', sessionId, 'has-gameroom-type'])
		})
		.then(function ([result]) {
			gameRoom = result
			return (!gameRoom || !isString(gameRoom)) ? gameRoom : false
		})
		//.finally(() => client.quit())
}

shared.checkSessionState = (sessionId, rawParams = {}) => {
	const params = JSON.stringify(rawParams)
	return db.call('checkSessionState', [sessionId, Date.now(), params])
	/*
        let state = false //ensure that this doesn't cache
        return Promise.try(function(){ //can't use es6 for this
            const sessionKey = helper._bar('sessions', sessionId)

            //ping the db

        })*/
}

shared.getSubscriptionsBySessionId = ([sessionId]) => {
	const client = db.createConnection('getSubscriptionsBySessionId')
	return new Promise((resolve, reject) => {
		let dbRoomList = []
		let roomKey, roomName
		const sessionRoomsKey = `sessions|${sessionId}|rooms`
		const stream = client.zscanStream(sessionRoomsKey)
		const multi = client.multi()

		stream.on('data', (result) => {
			if (Array.isArray(result)) {
				for (let i = 0; i < result.length; i += 2) {
					roomName = result[i]
					roomKey = `rooms|${roomName}|info`
					dbRoomList.push(roomName)
					multi.hget(roomKey, 'roomTypeId')
				}
			}
		})

		stream.on('end', () => {
			multi.exec()
				.map(([err, roomType], index) => [parseInt(roomType), dbRoomList[index]])
				.then((activeRoomList) => {
					resolve(activeRoomList)
				})
				.catch(reject)
		})

		stream.on('error', reject)
	})
		///*.finally(() => client.quit())*/

}

shared.getSubscriptionsAndSeatsIndexByRoom = ([roomName]) => {
	const client = db.createConnection('getSubscriptionsAndSeatsIndexByRoom')
	return new Promise((resolve, reject) => {
		let dbRoomList = []
		let str, seatIndex, sessionId
		const dbRoomKey = `rooms|${roomName}`
		const stream = client.zscanStream(dbRoomKey, {
			match: 'taken:seat:[1-9]*:*'
		})
		stream.on('data', (result) => {
			if (Array.isArray(result)) {
				for (let i = 0; i < result.length; i += 2) {
					//returns player [seat index, session id]
					if ([str, seatIndex, sessionId] = result[i].match('^taken:seat:(\\d+):(.*)$')) {
						dbRoomList.push([parseInt(seatIndex), sessionId])
					}
				}
			}
		})

		stream.on('end', () => {
			resolve(dbRoomList)
		})
		stream.on('error', reject)
	})/*.finally(() => { client.quit() })*/
}

shared.getSubscriptionsByRoom = ([roomName]) => {
	const client = db.createConnection('getSubscriptionsByRoom')
	return new Promise((resolve, reject) => {
		let dbRoomList = []
		let str, seatIndex, sessionId
		const dbRoomKey = `rooms|${roomName}`
		const roomInfoKey = `rooms|${roomName}|info`
		let roomType

		client.hget(roomInfoKey, 'typeIndex')
			.then((roomTypeValue) => {
				roomType = roomTypeValue

				const stream = client.zscanStream(dbRoomKey)

				stream.on('data', (result) => {
					if (Array.isArray(result)) {
						for (let i = 0; i < result.length; i += 2) {
							//returns player [seat index, session id]
							if ([str, seatIndex, sessionId] = result[i].match('^taken:seat:(\\d+):(.*)$')) {
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
	})/*.finally(() => client.quit())*/
}

shared.filterMultipleGameRooms = ([sessionId, roomList, intendedGameRoom]) => {
	let hasGameRoom = false

	const client = db.createConnection('filterMultipleGameRooms')

	//ensure that the latest game room called upon is saved
	//reverse the array to ensure the latest gameroom is used
	const revRoomList = roomList.reverse()
	return Promise.filter(revRoomList, ([type, room]) => {

		if (isGameRoom(type)) {
			if (intendedGameRoom === room) {
				hasGameRoom = true
				return client.setGameRoomIntent(sessionId, intendedGameRoom).return(true).catch((err) => false)
			}
			return false //remove duplicate game rooms
		}
		return true
	}).then((filteredRoomList) => {

		if (intendedGameRoom) {
			return client.filterMultipleGameRooms(sessionId)
				.then((rooms) => {
					const unsubscribe	= require('../jobs/room.unsubscribe')

					//const roomQueue = store.queues.getQueueByName('roomQueue')
					if (rooms && rooms.length > 0) {
						return unsubscribe({data:{sessionId, rooms}})
							//.then((nestedJob) => nestedJob.finished())
							.then((nestResult) => [sessionId, filteredRoomList.reverse()])
					} else {
						return Promise.resolve([sessionId, filteredRoomList.reverse()])
					}
				})

		} else {
			//reverse back
			return Promise.resolve([sessionId, filteredRoomList.reverse()])
		}
	})/*.finally(() => client.quit())*/
}
shared.filterReservations = ([sessionId, roomList]) => {
	const client = db.createConnection('filterReservations')
	const nodeTime = Date.now()

	const checkReservationFlag = ([type,room]) => {
		return client.checkRoomSubscribeTypeReserves(room)
			.then((status) => _isEqual('HAS RESERVATION FLAG', status))
			.catch((err) => {
				if(_isEqual('ROOM NO EXIST', err.message)) return isGameRoomByType(type)
				else throw new Error(err)
			})
	}

	const checkReservationRoom = ([type,room]) => {
		return client.checkRoomReservation(room, sessionId, nodeTime)
			.tap((s) => _log('RESERVE ROOM STATUS', s))
			.then((status) => _isEqual('NO RESERVES REQUIRED', status) || _isEqual('HAS RESERVATION', status))
			.return(true)
			.tapCatch(_error)
			.catch(() => false)
	}

	return Promise.filter(roomList, (data) => {
			return checkReservationFlag(data)
				.then((status) => (status) ? checkReservationRoom(data) : true)
				.tapCatch((err) => {
					if(_isEqual('NO RESERVATION', err.message)) _error('[ROOM] no reservation for %s in %s', sessionId, _get(data, 'room'))
					if(_isEqual('ROOM NO EXIST', err.message)) _error('[ROOM] %s does not exist', _get(data, 'room'))
				})
				.catch(() => false)
		})
		.then((filtered) => [sessionId, filtered])
		/*.finally(() => client.quit())*/
}/*
shared.filterReservations = ([sessionId, roomList]) => {
	return Promise.filter(roomList, ([type, room]) => {
			const client = Database.getClient()

			//Check if valid room and type
			if (!(isNumeric(type)) || !room) return false //remove from array

			const reservesKey = helper._bar('rooms', room, 'reserves')
			const serverTime = Date.now()

			switch (type) {
				case SYSTEM_ROOM_TYPE:
				case STANDARD_ROOM_TYPE:
					return true //keep in array
				case REALTIME_ROOM_TYPE:
				case TURNBASED_ROOM_TYPE:
					//keep in array

					return client.checkRoomReservation(room, sessionId, Date.now()).then((status) => {
						return status === 'OK'
					}).catch((err) => {
						_error('[Filter Reserves]', room, type, err.message)
						return false
					})
				//return client.zscore(reservesKey, sessionId).then((timeExpired) => isNumeric(timeExpired) ? timeExpired > serverTime : false)
				default:
					_error('[Filter Reserves]', room, 'no type')
					return false //remove from array
			}
		})
		.then((filtered) => [sessionId, filtered])
}
*/
shared.filterExistingSubs = ([sessionId, roomList]) => {
	return shared.getSubscriptionsBySessionId([sessionId])
		.then((existingSubs) => {

			const subList = _flatten(existingSubs)
			if (subList.length > 0) {
				return Promise.filter(roomList, ([type, room]) => !subList || !subList.includes(room))
					.then((filteredList) => [sessionId, filteredList])
			} else {
				return [sessionId, roomList]
			}
		})
}

shared.checkNonExistingSubsAndType = ([sessionId, roomList, removeEmptyRooms]) => {
	//uses the array from the db, as it has the type already defined.
	return shared.getSubscriptionsBySessionId([sessionId])
		//.tap((rooms) => _log('subs of session return', rooms,'|', roomList))
		.filter(([roomType, roomName]) => roomList.includes(roomName))
		.then((filteredList) => [sessionId, filteredList, removeEmptyRooms])
}

shared.getPlayersDataFromGameRoom = (roomName, options = {}) => {
	const client = db.createConnection('getPlayersDataFromGameRoom')

	const getPlayersData = new Promise((resolve, reject) => {
		let seatToSession = []
		const dbRoomKey = `rooms|${roomName}`
		const stream = client.zscanStream(dbRoomKey, {
			match: 'taken:seat:[1-9]*:*'
		})
		let str, sessionId, dbSessionKey, seatIndex
		let multi = client.multi()

		stream.on('data', (result) => {

			if (Array.isArray(result)) {
				for (let i = 0; i < result.length; i += 2) {
					//returns player [seat index, session id]
					if ([str, seatIndex, sessionId] = result[i].match('^taken:seat:(\\d+):(.*)$')) {
						if (sessionId && seatIndex > 0) {
							dbSessionKey = `sessions|${sessionId}`
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
					if (playerData && playerData.sessionId) {
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
					_error('err on player data from game room', err.toString())
					return reject(err.toString())
				})
		})

		stream.on('error', (err) => {
			multi.discard()
			return reject(err.toString())
		})
	})

	const roomType = new Promise((resolve, reject) => {
		if (options.roomType) {
			return resolve(options.roomType)
		}
		return shared.getRoomTypeFromDb(roomName).then(resolve).catch(reject)
	})

	return Promise.props({
			roomType: roomType,
			playersData: getPlayersData
		})
		.then((props) => {
			switch (props.roomType) {
				case TURNBASED_ROOM_TYPE:
				//_log('turn based', props.playersData)
				//let formatted = props.playersData.filter((player) => player.seatIndex) //only return those who have a seat number
				//return formatted.sort((a,b) => b.seatIndex-a.seatIndex) //rearrange by seat number

				case REALTIME_ROOM_TYPE:
				default:
					return props.playersData //return the formatted array
			}
		})
		/*.finally(() => client.quit())*/
}

shared.getThemeCounts = (roomPath) => {
	const client = db.createConnection('getThemeCounts')
	return new Promise((resolve, reject) => {
		const dbRoomKey = `counts|${roomPath}`
		const dbThemeCounts = {}
		const stream = client.zscanStream(dbRoomKey)

		stream.on('data', (result) => {

			if (Array.isArray(result)) {
				for (let i = 0; i < result.length; i += 2) {
					dbThemeCounts[result[i]] = parseInt(result[i + 1])
				}
			}
		})

		stream.on('end', () => {
			resolve(dbThemeCounts)
		})

		stream.on('error', (err) => {
			return reject(err.toString())
		})
	})/*.finally(() => client.quit())*/
}

/**
 * Room utility functions
 */

const isGameRoom = (id) => {
	switch (id) {
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
	let roomArr = JSON.stringify(roomNameToArr(roomName))

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
						if (roomArr.roomTheme === 'lobby') {
							return shared.commandPublishGameRoomLobbyUpdate(roomName, roomType)
						}
						return shared.commandPublishGameRoomUpdate(roomName, roomType)
					default:
						reject('No room type was found or defined')
						break
				}
			})
			.then((response) => resolve(response))
			.tapCatch((err) => _error('@roomUpdate',err))
			.catch((err) => reject(err.toString()))
	})
}

shared.handleVerifyRoomEvent = (data) => {

}

shared.getBotsEnabledInRoom = (roomArr) => {
	const serverConfig = store.getConfig()
	const botEnabledRoomConfig = serverConfig['botEnabledRooms']
	let isBotEnabledRoom = botEnabledRoomConfig['default']
	if (botEnabledRoomConfig[roomArr['roomGame']]) {
		isBotEnabledRoom = botEnabledRoomConfig[roomArr['roomGame']]
	}

	if (botEnabledRoomConfig[roomArr['roomGameThemeName']]) {
		isBotEnabledRoom = botEnabledRoomConfig[roomArr['roomGameThemeName']]
	}
	return isBotEnabledRoom
}

shared.getMaxSubscriptions = (roomArr) => {
	const serverConfig = store.getConfig()
	const maxSubscribersConfig = serverConfig['maxSubscribersPerRoom']
	let maxSubscriptions = maxSubscribersConfig['default']

	if (maxSubscribersConfig[roomArr.roomGame]) {
		maxSubscriptions = maxSubscribersConfig[roomArr['roomGame']]
	}
	return maxSubscriptions || 0
}

shared.getMaxObservers = (roomArr) => {
	const serverConfig = store.getConfig()
	const maxObserversConfig = serverConfig['maxObserversPerRoom']
	let maxObservers = maxObserversConfig['default']

	if (maxObserversConfig[roomArr['roomGame']]) {
		maxObservers = maxObserversConfig[roomArr['roomGame']]
	}

	return maxObservers || 0
}

shared.checkRoomExists = (roomName) => {
	return db.call('exists',[_join(['rooms', roomName, 'info'],'|')]).then((status) => _isEqual(status, 1))
}

//simplified
shared.setupRooms = ([sessionId, setupList]) => {
	return Promise.map(setupList, ([type, name, params = {}]) => {
		return shared.checkRoomExists(name).then((exists) => {
			if(!exists) return shared.setupRoom(sessionId, name, type, params)
			else return 'OK'
		}).return([type,name,params])
	}).then((roomList) => [sessionId, roomList])
}

/*shared.setupRooms = ([sessionId, roomList]) => {

	return Promise.try(function () { //can't use es6 for this
		const client = Database.getClient()
		let multi = client.multi()
		let setupList = []
		let subList = []

		//Setup multi
		for (let [_, room, props] of roomList) {
			multi.exists(helper._bar('rooms', room, 'info'))
		}

		return multi.exec()
			.tap(([err, result]) => {
				multi = client.multi()
			})
			//return room name as part of this list
			.each(([err, roomExists], index) => {
				const roomArr = roomList[index]
				const [type, room, params] = roomArr
				if (roomExists) {
					return subList.push(roomArr)
				} else {
					setupList.push(roomArr)
					return shared.setupRoom(sessionId, room, type, params, multi)
				}
			})
			.then(() => {
				if (setupList.length > 0) {
					return multi.exec()
				} else {
					multi.discard()
					return []
				}
			})
			.each(([err, setupResult], index) => {
				//verify the result
				if (err || !setupResult) {
					_error('error on room setup', err)
					return false
				}
				subList.push(setupList[index])
			})
			.tapCatch((err) => {
				_error('error on setup', err)
				multi.discard()
			})
			.then(() => {
				return [sessionId, subList]
			})
	})

}*/

/*shared.subToRooms = ([sessionId, roomList]) => {
	const client = Database.getClient()
	if (roomList.length <= 0) return Promise.resolve([sessionId, []])
	let multi = client.multi()
	let subList = []

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
			if (roomExists) {
				subList.push(roomArr)
				return shared.subToRoom(sessionId, room, type, params, multi)
			}
		})
		.then((results) => {
			if (results && subList.length > 0) {
				return multi.exec()
			} else {
				multi.discard()
				return []
			}
		})
		.each(([err, subResult], index) => {
			const roomArr = subList[index]
			const [type, room] = roomArr

			if (!err) {
				return shared.setupOnSubscribeJob(sessionId, room, type)
			} else {
				_error('[ERROR SUB MULTI] ', sessionId, type, room, err)
				return shared.unsubToRoom(sessionId, room, type, {isError: true, error: 'Invalid room'})
			}
		})
		.tapCatch(() => multi.discard())
		//todo: add filter
		.then(() => {
			_error('sub then', subList)
			//log finished subbing and sending jobs.
			return [sessionId, subList]
		})
}*/

//simplified
shared.subToRooms = ([sessionId, subList]) => {
	return Promise.map(subList, ([type, name, params]) => {
		return shared.checkRoomExists(name).then((exists) => {
			if(exists) return shared.subToRoom(sessionId, name, type, params).return([type,name,params]).catch(() =>[])
			else return [type, name, params]
		})
	}).then((roomList) => [sessionId, roomList])
}



/*shared.unSubFromRooms = ([sessionId, roomList, removeEmptyRooms = true]) => {
	if (roomList.length <= 0) return Promise.resolve([sessionId, [], removeEmptyRooms])
	const client = Database.getClient()
	let multi = client.multi()
	let destroyList = []

	//for each room passed in, add it to the multi
	return Promise.each(roomList, ([type, room]) => shared.unsubToRoom(sessionId, room, type, {}, multi))
		//execute the unsub
		.then(() => multi.exec())
		.tap((results) => { multi = client.multi() })
		//for each room, check counts and process the handler onUnsubscribe
		.each(([err, unSubResult], index) => {
			const [type, room] = roomList[index]

			if (!err) {
				if (unSubResult > 0) {
					return shared.setupOnUnSubscribeJob(sessionId, room, type)
				} else {
					return shared.getReservationCount(room)
						.then((numReserves) => {
							//if no reserves, destroy it.
							if (numReserves <= 0 && removeEmptyRooms) {
								destroyList.push(roomList[index])
								return shared.destroyRoom(type, room, multi)
							}
							return 'EMPTY SKIP DESTROY'
						})
				}
			} else {
				_error('[ERROR UNSUB MULTI] ', err.toString())
				return shared.unsubToRoom(sessionId, room, type, {}) //we'll try again but without using multi
			}
		})
		.then(() => {
			if (destroyList.length > 0) {
				return multi.exec()
			} else {
				multi.discard()
				return [sessionId, roomList, removeEmptyRooms]
			}
		})
		.tapCatch((err) => {
			_error('unsub error', err.toString())
			multi.discard()
		})
		.tap((result) => {_log('[UNSUB MULTI] destroy result', result, roomList)})
		.then(() => [sessionId, roomList, removeEmptyRooms])

}*/

//simplified
shared.unSubFromRooms = ([sessionId, roomList]) => {
	return Promise.map(roomList, ([type, name, params]) => {
		return shared.unSubFromRoom(sessionId, name, type, params).return([type,name,params]).tapCatch(_error).catch(() =>[])
		//return shared.checkRoomExists(name).then((exists) => {
			//if(!exists) return shared.unSubFromRoom(sessionId, name, type, params)
			//else return [type, name, params]

		//}).return([type,name,params])
	}).then((roomList) => [sessionId, roomList])
}

shared.setupOnSubscribeJob = (sessionId, room, type) => {
	const jobId = `onPlayerSubscribe:${room}`
	return Promise.props({
			id: jobId,
			sessionId: sessionId,
			roomName: room,
			roomType: type,
			bot: shared.checkIfBot(sessionId)
		})
		.then(function (dataToSend) {
			const roomQueue = store.queues.getQueueByName('roomQueue')
			return roomQueue.add('onPlayerSubscribe', dataToSend, {jobId: dataToSend.jobId, ...addConfig}).then((nestedJob) => nestedJob.finished())
		})
		.tapCatch((err) => _error('onsub', err.toString()))
}

shared.getReservationCount = (roomName) => {
	let numReservations = 0 //ensure that this doesn't cache
	let roomKey = `rooms|${roomName}|reserves`
	return Promise.try(function () { //can't use es6 for this
		return db.call('zcard', [roomKey])
		})
		.then(function (result) {
			numReservations = result //store result so we can nil
			return numReservations
		})
		.tapCatch((err) => _error(err))

}

shared.setupOnUnSubscribeJob = (sessionId, room, type) => {
	const jobId = `onPlayerUnSubscribe:${room}`
	return Promise.props({
			id: jobId,
			sessionId: sessionId,
			roomName: room,
			roomType: type,
			bot: shared.checkIfBot(sessionId)
		})
		.then(function (dataToSend) {
			const roomQueue = store.queues.getQueueByName('roomQueue')
			return roomQueue.add('onPlayerUnSubscribe', dataToSend, {jobId: dataToSend.jobId, ...addConfig}).then((nestedJob) => nestedJob.finished())
		})
		.tapCatch((err) => _error(err))
}
shared.roomNameToArr = (roomName) => {
	let roomPath, roomAppName, roomGame, roomTheme, roomId
	let roomNameArr = roomName.match('^(\\w+):(\\w+):(\\w+):([0-9]+)$')
	if(roomNameArr){
		[roomName, roomAppName, roomGame, roomTheme, roomId] = roomNameArr
		roomPath = roomAppName+":"+roomGame+":"+roomTheme
	} else {
		roomNameArr = roomName.match('^(\\w+):(\\w+):([a-zA-Z]+)$')
		if(roomNameArr)	[roomPath, roomAppName, roomGame, roomTheme] = roomNameArr
	}

	return {
		roomName,
		roomPath,

		roomAppName,
		roomGame,
		roomTheme,
		roomId: _.toInteger(roomId),

		//other room names
		roomAppGameName: _.join([roomAppName,roomGame],':'),
		roomAppGameThemeName: _.join([roomAppName,roomGame,roomTheme],':'),
		roomGameThemeName: _.join([roomGame,roomTheme],':'),
	}
}

/**
 * Main router function when user wants to join a room
 * @param sessionId
 * @param roomName
 * @param roomType
 * @param roomParams
 */
shared.setupRoom = (sessionId = 'server', roomName, roomType = getRoomTypeFromParams(), roomParams = {test2: '1'}) => {
	const client = db.createConnection('setupRoom')
	const currentTime = Date.now()
	_log('room arr is ', roomNameToArr(roomName))
	let roomProps = {
		roomType,
		roomSubscribeType: 'open',
		baseUpdateTime: 5000,
		reserveExpireTime: 5000,
		maxSubscribers: 10, //default
		maxBots: 9, //default
		maxObservers: 0, //default
		nextMessageId: 1,
		nextEventId: 1,
		roomParams: JSON.stringify(roomParams),

		//destroying: 1 /** @see destroySession **/
		...roomNameToArr(roomName)
	}

	//TODO: make files for these or call from db
	switch (roomType) {
		case SYSTEM_ROOM_TYPE:
			_.merge(roomProps, {
				roomType: 'system',
				roomTypeId: SYSTEM_ROOM_TYPE,
				isSystem: 1,
				roomHash: uuidv4(),
				created: currentTime,
				creator: sessionId,
				updated: currentTime,
				maxBots: 0,
				maxObservers: 0,
				validRoomEvents: JSON.stringify({})

			})
			break
		case REALTIME_ROOM_TYPE:
			_.merge(roomProps, {
				roomType: 'realtime',
				isGameRoom: 1,
				roomTypeId: REALTIME_ROOM_TYPE,
				roomSubscribeType: 'reserves',
				roomHash: uuidv4(),
				nextMessageId: 1,
				nextEventId: 1,
				created: currentTime,
				creator: sessionId,
				updated: currentTime,
				subscribers: 0,
				maxSubscribers: 4,
				bots: 0,
				observers: 0,
				maxObservers: -1,
				validRoomEvents: JSON.stringify({})
			})
			break
		case TURNBASED_ROOM_TYPE:
			_.merge(roomProps, {
				roomType: 'turnbased',
				isGameRoom: 1,
				isTurnBased: 1,
				roomTypeId: TURNBASED_ROOM_TYPE,
				roomSubscribeType: 'reserves',
				roomHash: uuidv4(),
				nextMessageId: 1,
				nextEventId: 1,
				created: currentTime,
				creator: sessionId,
				updated: currentTime,
				subscribers: 0,
				maxSubscribers: 4,
				bots: 0,
				observers: 0,
				maxObservers: -1,
				validRoomEvents: JSON.stringify({}),

				matchTemplate: JSON.stringify({}),
				matchId: 1,
				matchHash: uuidv4(),
				matchState: 'OPT_IN',
				matchProps: JSON.stringify({test: 'test'}),
				matchMessageIdStart: 1,
				matchTimeStart: currentTime,
				matchTurn: 0,
				matchTurnStart: 0,
				matchTurnExpire: 0,
				prevMatchId: -1,
				prevMatchHash: -1,
				prevMatchProps: JSON.stringify({}),
				prevMatchTimeStart: -1,
				prevMatchTimeEnd: -1,
				prevMessageIdStart: -1,
				prevMessageIdEnd: -1,
				nextMatchId: 1,
				nextMatchHash: uuidv4(),
				nextMatchProps: JSON.stringify({})
			})
			break
		default:
		case STANDARD_ROOM_TYPE:
			_.merge(roomProps, {
				roomType: 'standard',
				roomTypeId: STANDARD_ROOM_TYPE,
				roomHash: uuidv4(),
				nextMessageId: 1,
				nextEventId: 1,
				created: currentTime,
				creator: sessionId,
				updated: currentTime,
				subscribers: 0,
				bots: 0,
				maxBots: 3,
				observers: 0,
				maxObservers: 0,
				validRoomEvents: JSON.stringify({})
			})
			break

	}
	//roomProps = _.flatMap(roomProps, (key,value) => value && [value,key]).join(', ')

	console.log('@=====================================')
	console.log(roomProps)
	console.log()
	console.log('=====================================@')
	roomProps = JSON.stringify(roomProps)

	return new Promise((resolve, reject) => {
		client.createRoom(sessionId, roomName, currentTime, roomProps)
			.tap(_log)
			.then(() => client.syncRoomCounts(roomName, currentTime))
			.tap(_log)
			.then(resolve)
			.tap(_log).tapCatch((err) => _error(err)).catch(reject)
			/*.finally(() => client.quit())*/
	})
/*
	let roomArr = helper._roomNameToArr(roomName)
	let roomArrStr = JSON.stringify(roomArr)
	let maxObservers = shared.getMaxObservers(roomArr)
	let isBotEnabledRoom = shared.getBotsEnabledInRoom(roomArr)
	let maxSubscriptions = shared.getMaxSubscriptions(roomArr)

	return Promise.resolve()
		.then(() => {
			switch (roomType) {
				case SYSTEM_ROOM_TYPE:
					return redisClient.setupSystemRoom(creator, roomName, isBotEnabledRoom, 'LIMIT', maxSubscriptions, maxObservers)
				case STANDARD_ROOM_TYPE:
					return redisClient.setupStandardRoom(creator, roomName, isBotEnabledRoom, 'LIMIT', maxSubscriptions, maxObservers)
				case REALTIME_ROOM_TYPE:
					return redisClient.setupRealTimeGameRoom(creator, roomName, roomArrStr, isBotEnabledRoom, 'LIMIT', maxSubscriptions, maxObservers)
				case TURNBASED_ROOM_TYPE:
					return redisClient.setupTurnBasedGameRoom(creator, roomName, roomArrStr, isBotEnabledRoom, JSON.stringify({
						maxSubscriptions: maxSubscriptions,
						maxObservers: maxObservers,
						matchProps: {
							test: 'test'
						}
					}))
				default:
					throw new Error('No room type was found or defined')
			}
		}).tapCatch(_error)*/
}

shared.subToRoom = (sessionId, roomName, roomType, appendResponse = {}) => {

	const client = db.createConnection('subToRoom')
	let subsParams = {
		roomType,
		...roomNameToArr(roomName)
	}
	return new Promise((resolve, reject) => {
		client.subscribeRoom(sessionId, roomName, Date.now(), JSON.stringify(subsParams), JSON.stringify(appendResponse))
			.tap(_log)
			.then(() => client.syncRoomCounts(roomName, Date.now()))
			.tap(_log)
			.then(resolve)
			.tap(_log).tapCatch((err) => _error(err)).catch(reject)
	})
	/*
	return Promise.resolve()
		.then(() => {
			let strAppendResponse = JSON.stringify(appendResponse)

			switch (roomType) {
				case SYSTEM_ROOM_TYPE:
					return redisClient.subSystemRoom(sessionId, roomName, strAppendResponse)
				case STANDARD_ROOM_TYPE:
					return redisClient.subStandardRoom(sessionId, roomName, strAppendResponse)
				case REALTIME_ROOM_TYPE:
					return redisClient.subRealTimeGameRoom(sessionId, roomName, roomArr, strAppendResponse)
				case TURNBASED_ROOM_TYPE:
					return redisClient.subTurnBasedGameRoom(sessionId, roomName, roomArr, strAppendResponse)
				default:
					throw new Error('No room type was found or defined')
			}
		}).tapCatch(_error)*/
}

shared.unSubFromRoom = (sessionId, roomName, roomType, appendResponse = {}) => {
	let unSubParams = {
		roomType,
		...roomNameToArr(roomName)
	}

	return new Promise((resolve, reject) => {
		const client = db.createConnection('unsubFromRoom')

		client.unSubscribeRoom(sessionId, roomName, Date.now(), JSON.stringify(unSubParams), JSON.stringify(appendResponse))
			.tap(_log)
			.then(() => client.syncRoomCounts(roomName, Date.now()))
			.tap(_log)
			.then(resolve)
			.tap(_log).tapCatch((err) => _error(err)).catch(reject)
	})

	/*
        const roomArr = JSON.stringify(helper._roomNameToArr(roomName))

        return Promise.resolve()
            .then(() => {
                const strAppendResponse = JSON.stringify(appendResponse)
                switch (roomType) {
                    case SYSTEM_ROOM_TYPE:
                        return redisClient.unsubSystemRoom(sessionId, roomName, strAppendResponse)
                    case STANDARD_ROOM_TYPE:
                        return redisClient.unsubStandardRoom(sessionId, roomName, strAppendResponse)
                    case REALTIME_ROOM_TYPE:
                        return redisClient.unsubRealTimeGameRoom(sessionId, roomName, roomArr, strAppendResponse)
                    case TURNBASED_ROOM_TYPE:
                        return redisClient.unsubTurnBasedGameRoom(sessionId, roomName, roomArr, strAppendResponse)
                    default:
                        throw new Error('[Unsub]: No room type was found or defined')
                }
            }).tapCatch(_error)*/
}

shared.destroyRoom = (roomName, appendResponse = {}) => {
	const client = db.createConnection('destroyRoom')
	let destroyParams = {
		...roomNameToArr(roomName)
	}
	console.log('roomName', roomName)
	return client.destroyRoom(roomName, Date.now(), JSON.stringify(destroyParams), JSON.stringify(appendResponse))/*.finally(() => client.quit())*/
	/*
        if (!type) {
            type = shared.getRoomTypeFromDb(roomName)
        }

        let roomArr = JSON.stringify(helper._roomNameToArr(roomName))

        return Promise.resolve(type)
            .then((roomType) => {
                switch (roomType) {
                    case SYSTEM_ROOM_TYPE:
                        return redisClient.destroySystemRoom(roomName)
                    case STANDARD_ROOM_TYPE:
                        return redisClient.destroyStandardRoom(roomName)
                    case REALTIME_ROOM_TYPE:
                        return redisClient.destroyRealTimeGameRoom(roomName, roomArr)
                    case TURNBASED_ROOM_TYPE:
                        return redisClient.destroyTurnBasedGameRoom(roomName, roomArr)
                    default:
                        throw new Error('[Destroy]: No room type was found or defined')
                }
            })
            .catch((err) => {
                _error('error at destroy')
                _error(err.messages)
                if (err.message === 'NO ROOM TYPE') {
                    //if room doesn't exist then remove from tick db table
                    return redisClient.zrem('tick|rooms', roomName)
                }
                return new Error(err)
            })*/
}

shared.findAndDestroyRoom = (roomName) => {
	const client = db.createConnection('findAndDestroyRoom')
	const roomNameKey = `rooms|${roomName}`
	const shouldDestroy = () => {
		return client.exists(roomNameKey).then((state) => {
			if (state === 0) {
				return shared.getReservationCount(roomName)
					.then((numReserves) => {
						if (numReserves === 0) return shared.destroyRoom(roomName)
						return 'OK'
					})
			}
		})
	}
	return Promise.resolve(shouldDestroy())/*.finally(() => client.quit())*/
}

//Queue cleanup scripts
/*shared.removePlayerOnSubOrUnSubNotifications = (roomName) =>{
	const jobIdSub = helper._colon('onPlayerSubscribe', roomName)
	const jobIdUnSub = helper._colon('onPlayerUnSubscribe', roomName)

	const unsub = jobIdSub ? roomUpdateQueue.getJob(jobIdUnSub).then((job) => job.promote()).tapCatch(_error).catch((err) => false) : false
	const sub 	= jobIdUnSub ? roomUpdateQueue.getJob(jobIdSub).then((job) => job.promote()).tapCatch(_error).catch((err) => false) : false
	return Promise.all([sub, unsub])
}*/

/** Link lua scripts to commands **/

//Custom redis command but in node
shared.commandPublishGameRoomUpdate = (roomName, roomType) => {
	const roomInfoKey = `rooms|${roomName}|info`
	const client = db.createConnection('commandPublishGameRoomUpdate')

	return Promise.props({
			phase: 'roomUpdate',
			room: roomName,
			messageIndex: client.hincr(roomInfoKey, 'updateIndex', 1).then(([err, newIndex]) => newIndex),
			response: {
				players: shared.getPlayersDataFromGameRoom(roomName, {roomType: roomType}),
				room: roomName
			}
		})
		.then((dataToSend) => {
			let message = JSON.stringify(dataToSend)
			return client.publishToRoom(roomName, Date.now(), message)
		})
		.tapCatch((err) => _error(err))
		/*.finally(() => client.quit())*/

}

shared.commandPublishGameRoomLobbyUpdate = (roomPath, roomName) => {
	const client = db.createConnection('commandPublishGameRoomLobbyUpdate')
	return shared.getThemeCounts(roomPath, roomName)
		.then((playersData) => {
			let dataToSend = {
				phase: 'roomUpdate',
				room: roomName,
				response: {
					counts: playersData,
					room: roomName,
					roomPath: roomPath //v2
				}
			}
			let message = JSON.stringify(dataToSend)
			return client.publishToRoom(roomName, Date.now(), message)
		})
		.tapCatch((err) => _error(err))
		/*.finally(() => client.quit())*/
}

shared.checkForGameRoomsAndUnSub = ([sessionId, roomList]) => {
	const unsubscribe = require('../jobs/room.unsubscribe')
	_log('sessionId', sessionId, roomList)

	let hasGameRooms = []
	for (let [type, room] of roomList) {
		if (isGameRoom(type) && !hasGameRooms.includes(room)) {
			hasGameRooms.push(room)
			break
		}
		//if(hasGameRoom) break
	}

	if (hasGameRooms.length > 0) {
		const client = db.createConnection('checkForGameRoomsAndUnSub')
		return client.getGameRooms(sessionId)
			.each((room) => {
				if (hasGameRooms.includes(room)) {
					//don't destroy the room as we are reconnecting to it (probably with a different session id)
					return unsubscribe({data:{sessionId: sessionId, roomName: room, removeEmptyRooms: false}})
				} else {
					return unsubscribe({data:{sessionId: sessionId, roomName: room}})
				}
			})
			.then((result) => {
				_log('unsub rooms result', result)
				return [sessionId, roomList]
			})
			.tapCatch((err) => _error(err))
			/*.finally(() => client.quit())*/
			.catch((err) => {
				if (err.message === 'no game room') {
					return [sessionId, roomList]
				}
			})
	} else {
		_log('has no game rooms set')
		return Promise.resolve([sessionId, roomList])
	}
}

shared.commandUnSubSession = (client, sessionId, unsubType) => {
	return shared.getSubscriptionsBySessionId([sessionId])
		.then((roomList) => shared.unSubFromRooms([sessionId, roomList]))
		.then(() => client.destroySession(sessionId, unsubType))
		.tapCatch((err) => _error(err))
}

module.exports = shared
