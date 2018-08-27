"use strict"
const debug         = require('debug') //https://github.com/visionmedia/debug
debug.log = console.info.bind(console) //one all send all to console.
const _log          = debug('reserveJob')
//const _error        = debug('reserveJob:err')

const Promise       = require('bluebird')
const store			= require('../../store')

const _get 		= require('lodash/get')
const _has 		= require('lodash/has')
const _isEmpty	= require('lodash/isEmpty')
const _includes	= require('lodash/includes')
const isTest = process.env.MOCHA
const roomActions 	= require('../../scripts/room/shared')
const withDatabase = store.database.withDatabase

process.title = _includes(process.title, '/bin/node')? 'node_reserve' : process.title

const getRoomTypeFromParams = require('../../util/getRoomTypeFromParams')

const reserveOpenSeat = store.getLua("/room/updaters/reserveOpenSeat.lua")
const checkSessionState = store.getLua("/session/checkSessionState.lua")
const availableRoomsByPath = store.getLua("/room/collections/availableRoomsByPath.lua")
const checkReconnect = store.getLua("/room/validators/checkReconnect.lua")
const syncRoomCounts = store.getLua("/room/updaters/syncRoomCounts.lua")
const reserveNewRoomId = store.getLua("/room/updaters/reserveNewRoomId.lua")
const setupRoom = Promise.method(require('../room/setupRoom'))

module.exports = function(job){
	return withDatabase((db) => {
		const data 			= job.data
		const sessionId 	= data.sessionId
		const roomOrPath	= _get(data, 'room', _get(data, 'roomName', false)) // it can be roomName or roomPath
		const params		= data.params
		const nodeTime 		= Date.now()

		//validation
		if(!roomOrPath || !sessionId) throw new Error('INVALID PARAMETERS')

		_log('[Reserve] Data received %j', data)

		if(!_has('syncRoomCounts')) db.defineCommand('syncRoomCounts', { numberOfKeys: 1,lua: syncRoomCounts})
		if(!_has('reserveNewRoomId')) db.defineCommand('reserveNewRoomId', { numberOfKeys: 1, lua: reserveNewRoomId})
		if(!_has('reserveOpenSeat')) db.defineCommand('reserveOpenSeat', { numberOfKeys: 3, lua: reserveOpenSeat})
		if(!_has('checkSessionState')) db.defineCommand('checkSessionState', { numberOfKeys: 2, lua: checkSessionState})
		if(!_has('checkReconnect')) db.defineCommand('checkReconnect', { numberOfKeys: 2, lua: checkReconnect})
		if(!_has('availableRoomsByPath')) db.defineCommand('availableRoomsByPath', { numberOfKeys: 1, lua: availableRoomsByPath})

		const createNewRoomAndReserve = () => {
				return db.reserveNewRoomId(roomOrPath)//path
					.then((roomName) => {
						_log('new room is ', roomName)
						return setupRoom({db,sessionId, roomName, roomType: getRoomTypeFromParams(params), params})
							.then(() => db.reserveOpenSeat(roomName, sessionId, nodeTime))
							.return(roomName)
					})
		}

		const getFirstSuccessfulReservation = (roomsList) => {
				const reserveRoom = (roomName) => db.reserveOpenSeat(roomName,sessionId,nodeTime)
				return Promise.reduce(roomsList, (status, roomName) => {
					if(status)
						return status
					else
						return reserveRoom(roomName)
							.then((seat) => seat ? roomName : status)
							.catch(() => status)
				}, false)
		}

		return db.checkSessionState(sessionId, nodeTime, JSON.stringify({isTest}))
			.tap((result) => _log('[RESERVE] State', result))
			.then(() => db.checkReconnect(sessionId, roomOrPath, nodeTime))//roomOrPath is a roomName
			.tap((result) => _log('[RESERVE] prev room', result))
			.then((reconnectedRoom) => {

				if(reconnectedRoom && !_isEmpty(reconnectedRoom)){
					_log('room found existing', reconnectedRoom)
					return db.reserveOpenSeat(reconnectedRoom, sessionId, nodeTime).return(reconnectedRoom)
				}

				//check for available already created rooms
				return db.availableRoomsByPath(roomOrPath)//path
					.then((availableRooms) => {

						_log('rooms found is ', availableRooms)
						//no rooms available, so we create the room now
						if(_isEmpty(availableRooms))
							return false
						else
							return getFirstSuccessfulReservation(availableRooms)
					})
			})
			.tap((result) => _log('[RESERVE] reserve room', result))
			.then((roomReserved) => {
				if(!roomReserved) return createNewRoomAndReserve()
				return roomReserved
			})
			.then((roomReserved) => {
				_log('reserved is ', roomReserved)
				return db.syncRoomCounts(roomReserved, nodeTime).return(roomReserved)
			})
			.tap((result) => _log('[RESERVE] create room check ', result))
			.then((roomReserved) => {
				_log('room found is ', roomReserved)
				return {
					status: true,
					response: {
						roomName: roomReserved,
						params,
						message: "Reserved the seat for game room: " + roomReserved
					}
				}
			})

			.catch(Promise.AggregateError, function(err) {
				err.forEach(function(e) {
					console.error(e.stack)
				})
			})
			.catch((err) => {
				console.log('[Error Reserve]', err.status, err.message)
				console.log(err, err.stack.split("\n"))

				if(err.message === "NO SESSION"){
					//todo: fail the room
				}
				console.error(err.toString())
				throw new Error('ROOM NOT AVAILABLE')
			})
	}).tap(_log)
		.then((result) => Promise.resolve(result))
}
