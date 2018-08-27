const debug         = require('debug')      //https://github.com/visionmedia/debug
debug.log = console.info.bind(console)
const _log          = debug('subToRooms')
const _error        = debug('subToRooms:err')

const Promise = require('bluebird')

const _omit = require('lodash/omit')

const roomExists 			= Promise.method(require('../room/roomExists'))
const subToRoom 			= Promise.method(require('../room/subToRoom'))

module.exports = function(data){
	const {db, sessionId, roomList} = data
	_log('incoming', _omit(data, 'db'))
	return Promise.map(roomList, ([roomType, roomName, roomParams = {}]) => {
			return roomExists({db, roomName})
				.then((exists) =>
					(exists) ? subToRoom({db, sessionId, roomName, roomType, roomParams})
							.return([roomType, roomName, roomParams])
							.catch((err) => { _error('[SUB]', err.toString()); return ['ERROR', roomName, roomParams]})
						: Promise.resolve(['NO EXIST', roomName, roomParams]))
		})
		.tap((result) => {_log('room results', result)})
		.then((roomListResults) => ({...data, roomList: roomListResults}))
		.tapCatch(_error)
}
