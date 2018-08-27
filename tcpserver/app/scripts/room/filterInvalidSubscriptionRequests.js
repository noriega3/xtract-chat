const debug         = require('debug')      //https://github.com/visionmedia/debug
debug.log = console.info.bind(console)
const _log          = debug('filterSingleGameRoom')
const _error        = debug('filterSingleGameRoom:err')

const Promise = require('bluebird')
const store	  = require('../../store')

const isValidRoomByType = require('../../util/isValidRoomByType')

const _isEqual = require('lodash/isEqual')
const _clone = require('lodash/clone')

const unsubscribe 			= Promise.method(require('../jobs/room.unsubscribe'))

module.exports = function(data){
	const {db, sessionId, roomList} = data
	let newRoomList = _clone(roomList)

	return Promise.filter(newRoomList, ([type, room]) => (!isValidRoomByType(type)) ? unsubscribe({db, data:{sessionId, room}}).return(false).catchReturn(false) : true)
		.then(filteredList => ({...data, roomList: filteredList}))
		.tapCatch(_error)
		.catchThrow(new Error('INVALID FILTER ROOM'))
}
