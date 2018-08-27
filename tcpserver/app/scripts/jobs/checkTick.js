"use strict"


const debug         = require('debug') //https://github.com/visionmedia/debug
debug.log = console.info.bind(console) //one all send all to console.
const _log 			= debug('tick')
const _error 		= debug('tick:err')

const Promise		= require('bluebird')

const _get			= require('lodash/get')
const _isEqual 		= require('lodash/isEqual')
const _includes		= require('lodash/includes')
const _omit 		= require('lodash/omit')

process.title = _includes(process.title, '/bin/node')? 'node_room_tick' : process.title

const store			= require('../../store')
const withDatabase 	= store.database.withDatabase

const dbIdleRooms 	= store.getLua('/room/collections/idleRooms.lua')
const dbDestroyRoom = store.getLua('/room/destroyRoom.lua')

const roomNameToArr = require('../../util/roomNameToArr')
//TODO: look into pausing queue again when rooms are empty, then resuming when we have tick via session/room queue

module.exports = function(job) {
	const lastDbConnection = _get(job, 'db')
	const formatType = _get(job, 'formatType')


	const processRoomTick = () => {
		switch(_.toNumber(roomType)){
			case REALTIME_ROOM_TYPE:
				return realTimeActions.processTickEvent(roomName)
			case TURNBASED_ROOM_TYPE:
				return turnBasedActions.processTickEvent(roomName)
			default:
				new Error('[On Sub] Room Error: Wrong type of room')
		}
	}

	const processBotTask = () => {

	}

	return withDatabase((db) => {

		//get rooms that need to process tick
		db.defineCommand('idleRooms', {numberOfKeys: 0, lua: dbIdleRooms})
		return db.idleRooms(Date.now(), 10000)
			.each((foundName) => {
				//can either use a job or do it all at once
				return db.checkIdleRoom(foundName, Date.now()).then((status) => {
					if (_isEqual('IDLE', status))
						return destroyRoom(db, foundName)
					else
						return status
				})
			})

		//update tick value

		//output room props
		return db.checkRoomTick(roomName)
			.then(processRoomTick)

		const sessionId = _get(job, 'data.sessionId')
		const unsubType = _get(job, 'data.unsubType', 'normal')
		const isDestroy = _isEqual(unsubType, 'destroy')
		const errorMessage = _isEqual(unsubType, 'error') && _get(job, 'data.error')
		const skipSessionCheck = _get(job, 'data.skipSessionCheck', false) || isDestroy || _isEqual(unsubType, 'error')
		let roomList = _get(job, 'data.rooms', [])

		let intendedRoom = _get(job, 'data.room', _get(job, 'data.roomName', false))
		let intendedRoomParams = intendedRoom ? _get(job, 'data.params', {}) : false
		let intendedRoomTypeId = intendedRoomParams ? getRoomTypeFromParams(intendedRoomParams, 'GET') : false

		//append individual room
		if (intendedRoom && intendedRoomParams && intendedRoomTypeId) {
			roomList.push([intendedRoomTypeId, intendedRoom, intendedRoomParams])
		}

		_log('[UNSUB]', roomList)

		//check if room list is empty
		if (_isEmpty(roomList)) throw new Error("EMPTY ROOM LIST")

		//remove duplicates by name
		roomList = _uniqBy(roomList, (e) => e[1])

		//Check if session is active
		return db.checkSessionState(sessionId, Date.now(), JSON.stringify({skipSessionCheck}))
			.tap((result) => _log('[UNSUB] State', _omit(result, 'db')))

			.then(() => Promise.props({formatType: 'unsubscribe', db, sessionId, roomList, intendedRoom, errorMessage}))

			.then(formatRoomList)
			.tap((result) => _log('[UNSUB] Format Room List', _omit(result, 'db')))

			.then(filterValidSubscriptions) //required
			.tap((result) => _log('[UNSUB] Check valid subs', _omit(result, 'db')))

			.then(unsubToRooms)
			.tap((result) => {_log('[UNSUB] TO ROOMS', _omit(result, 'db'))})

			.tapCatch(_error)
			.then((result) => _omit(result, 'db'))

	}, lastDbConnection)
		.then((result) => {
			_log('[ROOM TICK] DONE', result)
			return result
		})
		.tapCatch((err) => {
			if (_isEqual('EMPTY ROOM LIST', err.message)) return _log('[UNSUB] room list empty, skipping unsubscribe')
			if (_isEqual('OFFLINE', err.message)) return _log('[SESSION] offline, skipping unsubscribe')
			_error('[Error Unsubscribe]', err.status, err.message)
			console.log(err.stack.split("\n"))
		})
}


