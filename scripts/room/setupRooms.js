const debug         = require('debug')      //https://github.com/visionmedia/debug
debug.log = console.info.bind(console)
const _log          = debug('setupRooms')
const _error        = debug('setupRooms:err')

const Promise = require('bluebird')

const roomExists 			= Promise.method(require('../room/roomExists'))
const setupRoom 			= require('../room/setupRoom')

module.exports = function(data){
	const {db, sessionId, roomList} = data
	return Promise.reduce(roomList,
		function(newRooms, [roomType, roomName, roomParams = {}]){
			return roomExists({db, roomName})
				.then((status) => (!status) ? setupRoom({db, sessionId, roomName, roomType, roomParams}) : true)
				.tap((result) => {_log('status',result)})
				.then((setup) => (setup) ? newRooms.push([roomType,roomName,roomParams]) : false)
				.tap((result) => {_log('setup',result)})
				.return(newRooms)
				.catchReturn(newRooms)
		},[])
		.then((newRoomList) => ({...data, roomList: newRoomList}))
		.tapCatch(_error)
}
