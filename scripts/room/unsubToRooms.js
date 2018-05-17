const debug         = require('debug')      //https://github.com/visionmedia/debug
debug.log = console.info.bind(console)
const _log          = debug('unSubToRooms')
const _error        = debug('unSubToRooms:err')

const Promise = require('bluebird')

const _omit 	= require('lodash/omit')
const _isEmpty	= require('lodash/isEmpty')

const roomExists 			= Promise.method(require('../room/roomExists'))
const unsubToRoom 			= Promise.method(require('../room/unsubToRoom'))

module.exports = function(data){
	const {db, sessionId, roomList, errorMessage} = data

	if(_isEmpty(roomList)) throw new Error("EMPTY ROOM LIST")

	_log('incoming', _omit(data, 'db'))

	return Promise.map(roomList, ([roomType, roomName, roomParams = {}]) => {
			return roomExists({db, roomName})
				.then((exists) => (exists) ?
					unsubToRoom({db, sessionId, roomName, roomType, roomParams, errorMessage})
						.return([roomType, roomName, roomParams])
						.catchReturn(['ERROR', roomName, roomParams])
					: ['NO EXIST', roomName, roomParams])
		})
		.tap((result) => {_log('room results', result)})
		.then((roomListResults) => ({...data, roomList: roomListResults}))
		.tapCatch(_error)
}
