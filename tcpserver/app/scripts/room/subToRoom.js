const debug         = require('debug')      //https://github.com/visionmedia/debug
debug.log = console.info.bind(console)
const _log          = debug('subToRoom')
const _error        = debug('subToRoom:err')

const _has			= require('lodash/has')

const Promise = require('bluebird')
const store	  = require('../../store')

const subscribeRoom 	= store.getLua('/room/subscribeRoom.lua')
const syncRoomCounts 	= store.getLua('/room/updaters/syncRoomCounts.lua')
const publishUpdateToRoom 	= store.getLua('/room/publishUpdateToRoom.lua')

const roomNameToArr			= require('../../util/roomNameToArr')

module.exports = function(data) {
	const {db, sessionId, roomName, roomType, roomParams} = data
    const currentTime = Date.now()

	if(!_has(db, 'subscribeRoom')) db.defineCommand('subscribeRoom', {numberOfKeys: 3, lua: subscribeRoom})
	if(!_has(db, 'syncRoomCounts')) db.defineCommand('syncRoomCounts', {numberOfKeys: 1, lua: syncRoomCounts})
	if(!_has(db, 'publishUpdateToRoom')) db.defineCommand('publishUpdateToRoom', {numberOfKeys: 1, lua: publishUpdateToRoom})

	let subsParams = {
		roomType,
		...roomNameToArr(roomName)
	}

	return db
		.subscribeRoom(sessionId, roomName, currentTime, JSON.stringify(subsParams), JSON.stringify(roomParams))
		.then(() => db.syncRoomCounts(roomName, currentTime))
		.then(() => db.publishUpdateToRoom(roomName, currentTime))
		.return(true)
		.tapCatch((err) => { _error('[SUB ERR]', err)})
		.catchReturn(false)
}
