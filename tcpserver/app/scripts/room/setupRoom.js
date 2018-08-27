const debug         = require('debug')      //https://github.com/visionmedia/debug
debug.log = console.info.bind(console)
const _log          = debug('setupRoom')
const _error        = debug('setupRoom:err')

const uuidv4 = require('uuid/v4')
const Promise = require('bluebird')
const store	  = require('../../store')

const _has	= require('lodash/has')
const _merge	= require('lodash/merge')
const _endsWith	= require('lodash/endsWith')

const syncRoomCounts 	= store.getLua('/room/updaters/syncRoomCounts.lua')
const createRoom 			= store.getLua('/room/createRoom.lua')
const roomNameToArr			= require('../../util/roomNameToArr')

const {
	SYSTEM_ROOM_TYPE,
	TURNBASED_ROOM_TYPE,
	REALTIME_ROOM_TYPE,
	STANDARD_ROOM_TYPE
} = require('../constants')

module.exports = Promise.method(function(data){
	const {db, sessionId, roomName, roomType, roomParams} = data

    if(!_has(db, 'syncRoomCounts')) db.defineCommand('syncRoomCounts', {numberOfKeys: 1, lua: syncRoomCounts})
    if(!_has(db, 'createRoom')) db.defineCommand('createRoom', {numberOfKeys: 3, lua: createRoom})

	const currentTime = Date.now()

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
		validSubParamKeys: JSON.stringify(['debug', 'hash', 'timeout', 'bet', 'wager', 'room']),
		validUnSubParamKeys: JSON.stringify(['debug', 'hash', 'bet', 'wager']),
		isLobby: _endsWith(roomName, ':lobby') ? 1 : undefined,
		isOverall: _endsWith(roomName, ':overall') ? 1 : undefined,
		//destroying: 1 /** @see destroySession **/
		...roomNameToArr(roomName)
	}

	//TODO: make files for these or call from db
	switch (roomType) {
		case SYSTEM_ROOM_TYPE:
			_merge(roomProps, {
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
			_merge(roomProps, {
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
			_merge(roomProps, {
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
		case STANDARD_ROOM_TYPE:
			_merge(roomProps, {
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
		default:
			throw new Error('INVALID ROOM TYPE')
	}

	_log('@=====================================')
	_log(roomProps)
	_log('=====================================@')

	roomProps = JSON.stringify(roomProps)

	return db
		.createRoom(sessionId, roomName, currentTime, roomProps)
		.then(() => db.syncRoomCounts(roomName, currentTime))
		.return(true)
		.tapCatch((err) => {_error('[SETUP ROOM]', err)})
		.catchReturn(false)
})
