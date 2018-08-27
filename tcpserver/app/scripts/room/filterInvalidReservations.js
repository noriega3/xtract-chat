const debug         = require('debug')      //https://github.com/visionmedia/debug
debug.log = console.info.bind(console)
const _log          = debug('filterInvalidReservations')
const _error        = debug('filterInvalidReservations:err')

const Promise = require('bluebird')

const _isEqual = require('lodash/isEqual')
const _get = require('lodash/get')
const _clone = require('lodash/clone')

const store	  = require('../../store')

const isGameRoomByType = require('../../util/isGameRoomByType')
const checkRoomSubscribeTypeReserves = store.getLua('/room/validators/checkRoomSubscribeTypeReserves.lua')
const checkRoomReservation = store.getLua('/room/validators/checkRoomReservation.lua')

module.exports = function(data){
	const {db, sessionId, roomList} = data
	const nodeTime = Date.now()
	let newRoomList = _clone(roomList)

	//no game room, continue on.
	//note: non-game rooms can have reservations
	//if(!intendedRoom) return Promise.resolve(data)

	db.defineCommand('checkRoomSubscribeTypeReserves', {numberOfKeys: 1, lua: checkRoomSubscribeTypeReserves})
	db.defineCommand('checkRoomReservation', {numberOfKeys: 3, lua: checkRoomReservation})

	const checkReservationFlag = Promise.method(function([type,room]){
		return db.checkRoomSubscribeTypeReserves(room)
			.then((status) => _isEqual('HAS RESERVATION FLAG', status))
			.catch((err) => {
				if(_isEqual('ROOM NO EXIST', err.message)) return isGameRoomByType(type)
				else throw new Error(err)
			})
	})

	const checkReservationRoom = Promise.method(function([,room]){
		return db.checkRoomReservation(room, sessionId, nodeTime)
			.tap((s) => _log('RESERVE ROOM STATUS', s))
			.then((status) => _isEqual('NO RESERVES REQUIRED', status) || _isEqual('HAS RESERVATION', status))
			.return(true)
			.tapCatch(_error)
			.catchReturn(false)
	})

	return Promise.filter(newRoomList, function(room){
			return checkReservationFlag(room)
				.then((status) => (status) ? checkReservationRoom(room) : true)
				.tapCatch((err) => {
					if(_isEqual('NO RESERVATION', err.message)) _error('[ROOM] no reservation for %s in %s', sessionId, _get(data, 'room'))
					if(_isEqual('ROOM NO EXIST', err.message)) _error('[ROOM] %s does not exist', _get(data, 'room'))
				})
				.catchReturn(false)
		})
		.then((filteredList) => ({...data, roomList: filteredList}))
}
