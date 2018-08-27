"use strict"


const debug         = require('debug') //https://github.com/visionmedia/debug
debug.log = console.info.bind(console) //one all send all to console.
const _log          = debug('unsubscribe')
const _error        = debug('unsubscribe:err')

const Promise		= require('bluebird')

const _isEqual		= require('lodash/isEqual')
const _includes		= require('lodash/includes')
const _get			= require('lodash/get')
const _omit			= require('lodash/omit')
const _isEmpty		= require('lodash/isEmpty')
const _uniqBy		= require('lodash/uniqBy')
const _has			= require('lodash/has')

process.title = _includes(process.title, '/bin/node')? 'node_unsubscribe' : process.title

const store			= require('../../store')
const withDatabase 	= store.database.withDatabase

const checkSessionState = store.getLua("/session/checkSessionState.lua")

const formatRoomList			= Promise.method(require('../room/formatRoomList'))
const filterValidSubscriptions	= Promise.method(require('../room/filterValidSubscriptions'))
const unsubToRooms 				= Promise.method(require('../room/unsubToRooms'))
const getRoomTypeFromParams		= require('../../util/getRoomTypeFromParams')


module.exports = function(job){
	const lastDbConnection	= _get(job, 'db')
	return withDatabase((db) => {
		const sessionId 		= _get(job, 'data.sessionId')
		const unsubType			= _get(job, 'data.unsubType', 'normal')
		const isDestroy			= _isEqual(unsubType, 'destroy')
		const errorMessage	 	= _isEqual(unsubType, 'error') && _get(job, 'data.error')
		const skipSessionCheck 	= _get(job, 'data.skipSessionCheck', false) || isDestroy || _isEqual(unsubType, 'error')
		let roomList 			= _get(job, 'data.rooms', [])

		let intendedRoom 		= _get(job, 'data.room', _get(job, 'data.roomName', false))
		let intendedRoomParams 	= intendedRoom ? _get(job, 'data.params', {}) : false
		let intendedRoomTypeId 	= intendedRoomParams ? getRoomTypeFromParams(intendedRoomParams, 'GET') : false

		//append individual room
		if(intendedRoom && intendedRoomParams && intendedRoomTypeId){
			roomList.push([intendedRoomTypeId, intendedRoom, intendedRoomParams])
		}

		_log('[UNSUB]', roomList)

		//check if room list is empty
		if(_isEmpty(roomList)) throw new Error("EMPTY ROOM LIST")

		//remove duplicates by name
		roomList = _uniqBy(roomList, (e) => e[1])

		//Check if session is active
		if(!_has(db, 'checkSessionState')) db.defineCommand('checkSessionState', { numberOfKeys: 2, lua: checkSessionState})

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
			_log('[UNSUB] DONE', result)
			return result
		})
		.tapCatch((err) => {
			if(_isEqual('EMPTY ROOM LIST', err.message)) return _log('[UNSUB] room list empty, skipping unsubscribe')
			if(_isEqual('OFFLINE', err.message)) return _log('[SESSION] offline, skipping unsubscribe')
			_error('[Error Unsubscribe]', err.status, err.message)
			console.log(err.stack.split("\n"))
		})
}
