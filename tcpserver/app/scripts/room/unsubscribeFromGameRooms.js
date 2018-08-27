const debug         = require('debug')      //https://github.com/visionmedia/debug
debug.log = console.info.bind(console)
const _log          = debug('unsubFromGameRooms')
const _error        = debug('unsubFromGameRooms:err')

const Promise = require('bluebird')
const store	  = require('../../store')

const _clone = require('lodash/clone')
const _filter = require('lodash/filter')
const _isEqual = require('lodash/isEqual')
const _isEmpty = require('lodash/isEmpty')

const unsubscribe = Promise.method(require('../jobs/room.unsubscribe'))
const isGameRoomByType = require('../../util/isGameRoomByType')

const getSessionGameRooms 	= store.getLua('/rooms/getSessionGameRooms.lua')

module.exports = function(data){
	const {client, sessionId, roomList, intendedGameRoom} = data

	client.defineCommand('getSessionGameRooms', {numberOfKeys: 1, lua: getSessionGameRooms})
	if(!intendedGameRoom) return Promise.resolve(data)

	//Filter the subscriber roomList
	const unSubList = roomList ? _filter(_clone(roomList), ({roomType, roomName}) => !isGameRoomByType(roomType) || !_isEqual(roomName, intendedGameRoom)) : []

	if(_isEmpty(unSubList)) return Promise.resolve(data)

	//Filter the database store
	return client.getSessionGameRooms(sessionId)
		.each((room) => {
			if(_isEqual(room, intendedGameRoom)) return Promise.resolve('OK')
			return unsubscribe({
				client,
				data: {
					sessionId,
					roomName: room,
					removeEmptyRooms: unSubList.includes(room)
				}
			})
		})
		.then((result) => {
			_log('unsub rooms result', result)
			return [sessionId, roomList]
		})
		.tapCatch((err) => _error(err))
		.catch((err) => {
			if (_isEqual(err.message,'no game room')) {
				return [sessionId, roomList]
			}
		})
}
