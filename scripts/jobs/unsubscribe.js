"use strict"
const debug         = require('debug') //https://github.com/visionmedia/debug
debug.log = console.info.bind(console) //one all send all to console.
const _log          = debug('unsubscribe')
const _error        = debug('unsubscribe:err')
const Promise		= require('bluebird')
const store			= require('../../store')
const _isEqual		= require('lodash/isEqual')
const _has			= require('lodash/has')
const _get			= require('lodash/get')
const _size			= require('lodash/size')
const getConnection = store.database.getConnection
const RoomActions 	= require('../room/shared')

const {
	formatRoomList,
	filterRoomTypes,
	filterValidSubscriptions,
	sendUnsubscribe
} = require('../room')
const getRoomTypeFromParams = require('../../util/getRoomTypeFromParams')

const roomNameToArr = require('../../util/roomNameToArr')

module.exports = (job) => {
	const data 				= job.data
	const skipInitCheck 	= data.isInit
	const sessionId 		= data.sessionId

	let rawRoomList 		= data.rooms || []
	let intendedRoom 		= _get(data, 'room', _get(data, 'roomName', false))
	let intendedRoomParams	= data.params || {}

	//append individual room
	if(intendedRoom)
		rawRoomList.push([
			getRoomTypeFromParams(intendedRoomParams, 'GET'),
			intendedRoom,
			intendedRoomParams
		])

	_log('rawRoomList', rawRoomList)

	//check if room list is empty
	if(rawRoomList.length <= 0) return 'EMPTY'

	_log('[UNSUB]', rawRoomList)

	//TODO: match roomList like subscribe
	//TODO: - roomList = [[type, roomName, unsubParams],[type, anotherRoomName, unsubParams]]
	// have type and unsubParams be optional

	//TODO: - roomList = [roomName, anotherRoomName] (currently)

	return Promise.using(getConnection(), (client) => {

		//Check if session is active
		return client.checkSessionState(sessionId, Date.now(), JSON.stringify({skipInitCheck}))
			//.tap((result) => _log('[UNSUB] State', result.toString()))
			.then(() => formatRoomList(rawRoomList))
			.tap((result) => _log('[UNSUB] Format Room List', result))
			.then((roomList) => filterValidSubscriptions([sessionId, roomList])) //required
			.tap((result) => _log('[UNSUB] Check valid subs', result))
			.then((roomList) => {
				if(_size(roomList) <= 0) return 'EMPTY'

				return Promise.each(roomList, ([roomType,roomName,roomParams]) => {
					_log('roomType', roomType)
					_log('roomName', roomName)
					_log('roomParams', roomParams)
					let unSubParams = {
						roomType,
						...roomNameToArr(roomName)
					}
					return client.unSubscribeRoom(sessionId, roomName, Date.now(), JSON.stringify(unSubParams), JSON.stringify(roomParams))
						.tap(_log)
						.then(() => client.syncRoomCounts(roomName, Date.now()))
						.tap(_log)
						.return('OK')
						.tap(_log).tapCatch((err) => _error(err)).catch(() => 'error')
				})

			})
			.tap((result) => _log('[UNSUB] Unsub', result.toString()))
	})
	.return('OK')
	.catch((err) => {
		if(_isEqual('EMPTY ROOM LIST', err.message)) return _log('[UNSUB] room list empty, skipping unsubscribe')
		if(_isEqual('OFFLINE', err.message)) return _log('[SESSION] offline, skipping unsubscribe')
		_error('[Error Unsubscribe]', err.status, err.message)
		console.log(err, err.stack.split("\n"))
		throw new Error(err)
	})
}
