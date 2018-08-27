const debug         = require('debug')      //https://github.com/visionmedia/debug
debug.log = console.info.bind(console)
const _log          = debug('unSubToRooms')
const _error        = debug('unSubToRooms:err')

const Promise = require('bluebird')
const store	  = require('../../store')

const unSubscribeRoom 	= store.getLua('/room/unSubscribeRoom.lua')
const syncRoomCounts 	= store.getLua('/room/updaters/syncRoomCounts.lua')
const publishUpdateToRoom 	= store.getLua('/room/publishUpdateToRoom.lua')

const roomNameToArr			= require('../../util/roomNameToArr')

module.exports = function(data) {
	const {db, sessionId, roomName, roomType, roomParams} = data

	db.defineCommand('unSubscribeRoom', {numberOfKeys: 3, lua: unSubscribeRoom})
	db.defineCommand('syncRoomCounts', {numberOfKeys: 1, lua: syncRoomCounts})
	db.defineCommand('publishUpdateToRoom', {numberOfKeys: 1, lua: publishUpdateToRoom})
	const currentTime = Date.now()

	let unSubParams = {
		roomType,
		...roomNameToArr(roomName)
	}

	return db
		.unSubscribeRoom(sessionId, roomName, currentTime, JSON.stringify(unSubParams), JSON.stringify(roomParams))
		.then(() => db.syncRoomCounts(roomName, currentTime))
		.then(() => db.publishUpdateToRoom(roomName, currentTime).catchReturn('OK'))
		.return('OK')
		.tapCatch(_error)
		.catchReturn('error')
}
