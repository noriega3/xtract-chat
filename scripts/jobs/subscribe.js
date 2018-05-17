"use strict"
let apm = require('elastic-apm-node')
const debug         = require('debug') //https://github.com/visionmedia/debug
debug.log			= console.info.bind(console) //one all send all to console.
const Promise		= require('bluebird')

const _get			= require('lodash/get')
const _omit			= require('lodash/omit')
const _isEmpty		= require('lodash/isEmpty')
const _isEqual		= require('lodash/isEqual')
const _includes		= require('lodash/includes')
const _uniqBy		= require('lodash/uniqBy')
const _isInteger		= require('lodash/isInteger')

process.title = _includes(process.title, '/bin/node') ? 'node_subscribe' : process.title

const store			= require('../../store')
const withDatabase	= store.database.withDatabase

const unsubscribe				= Promise.method(require('./unsubscribe'))
const formatRoomList 			= Promise.method(require('../room/formatRoomList'))
const filterSingleGameRoom 		= Promise.method(require('../room/filterSingleGameRoom'))
const filterInvalidReservations = Promise.method(require('../room/filterInvalidReservations'))
const filterInvalidRooms 		= Promise.method(require('../room/filterInvalidSubscriptionRequests'))
const setupRooms 				= Promise.method(require('../room/setupRooms'))
const subToRooms 				= Promise.method(require('../room/subToRooms'))

const getRoomTypeFromParams = require('../../util/getRoomTypeFromParams')
console.log('process.title', process.title)


module.exports = function(job){
	const lastDbConnection = _get(job, 'db')
	const dbTrans = apm.startTransaction('job', 'subscribe')
	let _log          = debug('subscribe')
	let _error        = debug('subscribe:err')

	return withDatabase((db) => {
		let span = apm.startSpan('db', 'prep')
		const sessionId 		= _get(job, 'data.sessionId')
		const skipSessionCheck 	= _get(job, 'data.skipSessionCheck', false)
		let roomList 			= _get(job, 'data.rooms', [])

		let intendedRoom 		= _get(job, 'data.room', _get(job, 'data.roomName', false))
		let intendedRoomParams 	= intendedRoom ? _get(job, 'data.params', {}) : false
		let intendedRoomTypeId 	= intendedRoomParams ? getRoomTypeFromParams(intendedRoomParams) : false

		//append individual room
		if(intendedRoom && intendedRoomParams && _isInteger(intendedRoomTypeId)){
			roomList.push([intendedRoomTypeId, intendedRoom, intendedRoomParams])
		}

		_log('[SUB]', roomList)

		//check if room list is empty
		if(_isEmpty(roomList)) throw new Error('EMPTY')

		//remove duplicates by name
		roomList = _uniqBy(roomList, (e) => e[1])

		span.end()
		span = apm.startSpan('db', 'dbCalls')

		//Check if session is active
		return db.checkSessionState(sessionId, Date.now(), JSON.stringify({skipSessionCheck}))
			//.tap((result) => _log('[SUB] State', result.toString()))
			.then(() => Promise.props({formatType: 'subscribe', db, sessionId, roomList, intendedRoom}))

			//Filter any duplicate game rooms passed in.
			.then(filterSingleGameRoom) //returns [sessionId, roomList] filtered
			.tap((result) => _log('[SUB] Filter Single / Invalid Game Room(s)', _omit(result, 'db')))

			//Check if reservation for room based on room type
			.then(filterInvalidReservations) //returns [sessionId, roomList] filtered
			.tap((result) => _log('[SUB] Filter Reserve', _omit(result, 'db')))

			//Check if user is already in the rooms passed in and filter out
			.then(filterInvalidRooms) //returns [sessionId, roomList] filtered
			.tap((result) => _log('[SUB] Filter Invalid Rooms', _omit(result, 'db')))

			//check if we need to create room
			.then(setupRooms) //returns [sessionId, roomList] creates any non existing rooms
			.tap((result) => _log('[SUB] Setup', _omit(result, 'db')))

			//format the incoming data to a 3 indexed validated array
			.then(formatRoomList)
			.tap((result) => _log('[SUB] formatted', _omit(result, 'db')))

			//Remove session from any existing game rooms
			//.then(unsubscribeFromGameRooms) //Note: this is already being done in filterSingleGameRoom
			//.tap((result) => _log('[SUB] Remove From Existing', _omit(result, 'client')))

			//Subscribes to rooms and passes in params from job.
			.then(subToRooms) //subscribes to rooms
			.tap((result) => {
				span.end()
				span = null
				_log('[SUB] TO ROOMS', _omit(result, 'db'))
			})

			.tapCatch(_error)
			.catch((error) => unsubscribe({db, data:{sessionId: sessionId, rooms: roomList, error}}))
			.then((result) => _omit(result, 'db'))

	}, lastDbConnection)
		.then((result) => {
			_log('[SUB] DONE', result)
			dbTrans.end(200)
			return result
		})
		.tapCatch((err) => {
			dbTrans.end(500)
			if(_isEqual('EMPTY ROOM LIST', err.message)) return _log('[SUBSCRIBE] room list empty, skipping SUBSCRIBE')
			if(_isEqual('OFFLINE', err.message)) return _log('[SESSION] offline, skipping SUBSCRIBE')
			_error('[Error SUBSCRIBE]', err.status, err.message)
			console.log(err, err.stack.split("\n"))
		}).finally(() => {
			_log.destroy()
			_error.destroy()
		})
}
