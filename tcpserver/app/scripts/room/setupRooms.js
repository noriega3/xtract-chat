const debug         = require('debug')      //https://github.com/visionmedia/debug
debug.log = console.info.bind(console)
const _log          = debug('setupRooms')
const _error        = debug('setupRooms:err')

const Promise = require('bluebird')

const roomExists 			= Promise.method(require('../room/roomExists'))
const setupRoom 			= require('../room/setupRoom')

module.exports = function(data){
	const {db, sessionId, roomList} = data
	_log('room list for setup', roomList)
	return Promise.reduce(roomList,
		function(newRooms, [roomType, roomName, roomParams = {}]){
			return roomExists({db, roomName})
				.then((status) => (!status) ? setupRoom({db, sessionId, roomName, roomType, roomParams}) : Promise.resolve(true))
				.tap((setup) => {
                    _log('room is setup', setup, roomName)
                    if (setup) newRooms.push([roomType,roomName,roomParams])
				})
				.return(newRooms)
				.catch((err) => {_error(err); return newRooms})
		},[])
		.then((newRoomList) => ({...data, roomList: newRoomList}))
		.tapCatch((err) => {_error('[SETUP]', err)})
}
