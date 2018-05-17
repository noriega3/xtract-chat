const debug         = require('debug')      //https://github.com/visionmedia/debug
debug.log = console.info.bind(console)
const _log          = debug('subToRooms')
const _error        = debug('subToRooms:err')

const Promise = require('bluebird')
const store	  = require('../../store')

const subscribeRoom 	= store.getLua('./scripts/redis2/room/subscribeRoom.lua')
const syncRoomCounts 	= store.getLua('./scripts/redis2/room/updaters/syncRoomCounts.lua')
const publishUpdateToRoom 	= store.getLua('./scripts/redis2/room/publishUpdateToRoom.lua')

const roomNameToArr			= require('../../util/roomNameToArr')

module.exports = function(data) {
	const {db, sessionId, roomName, roomType, roomParams} = data

	db.defineCommand('createRoom', {numberOfKeys: 3, lua: subscribeRoom})
	db.defineCommand('syncRoomCounts', {numberOfKeys: 1, lua: syncRoomCounts})
	db.defineCommand('publishUpdateToRoom', {numberOfKeys: 1, lua: publishUpdateToRoom})
	const currentTime = Date.now()

	let subsParams = {
		roomType,
		...roomNameToArr(roomName)
	}

	return db
		.subscribeRoom(sessionId, roomName, currentTime, JSON.stringify(subsParams), JSON.stringify(roomParams))
		.then(() => db.syncRoomCounts(roomName, currentTime))
		.then(() => db.publishUpdateToRoom(roomName, currentTime))
		.return('OK')
		.tapCatch(_error)
		.catchReturn(false)
}
