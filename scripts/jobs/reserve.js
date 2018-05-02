"use strict"
const debug         = require('debug') //https://github.com/visionmedia/debug
debug.log = console.info.bind(console) //one all send all to console.
const _log          = debug('reserveJob')
//const _error        = debug('reserveJob:err')

const Promise       = require('bluebird')
const store			= require('../../store')

const _get 		= require('lodash/get')
const _isEmpty	= require('lodash/isEmpty')
const isTest = process.env.MOCHA
const roomActions 	= require('../../scripts/room/shared')

const getConnection = store.database.getConnection

const getRoomTypeFromParams = require('../../util/getRoomTypeFromParams')

module.exports = (job) => {

	const data 			= job.data
	const sessionId 	= data.sessionId
	const roomOrPath	= _get(data, 'room', _get(data, 'roomName', false)) // it can be roomName or roomPath
	const params		= data.params
	const nodeTime 		= Date.now()

	//validation
	if(!roomOrPath || !sessionId) throw new Error('INVALID PARAMETERS')

	_log('[Reserve] Data received %j', data)

	const createNewRoomAndReserve = () => {
		return Promise.using(getConnection(), (client) => {
			return client.reserveNewRoomId(roomOrPath)//path
				.then((newRoomName) => {
					_log('new room is ', newRoomName)
					return roomActions
						.setupRoom(sessionId, newRoomName, getRoomTypeFromParams(params), JSON.stringify(params))
						.then(() => client.reserveOpenSeat(newRoomName, sessionId, nodeTime))
						.return(newRoomName)
				})
		})
	}

	const getFirstSuccessfulReservation = (roomsList) => {
		return Promise.using(getConnection(), (client) => {
			const reserveRoom = (roomName) => client.reserveOpenSeat(roomName,sessionId,nodeTime)
			return Promise.reduce(roomsList, (status, roomName) => {
				if(status)
					return status
				else
					return reserveRoom(roomName)
						.then((seat) => seat ? roomName : status)
						.catch(() => status)
			}, false)
		})
	}

	//Check if session is active
	return Promise.using(getConnection(), (client) => {
		return client.checkSessionState(sessionId, nodeTime, JSON.stringify({isTest}))
			.tap((result) => _log('[RESERVE] State', result))
			.then(() => client.checkReconnect(sessionId, roomOrPath, nodeTime))//roomOrPath is a roomName
			.tap((result) => _log('[RESERVE] prev room', result))
			.then((reconnectedRoom) => {

				if(reconnectedRoom && !_isEmpty(reconnectedRoom)){
					_log('room found existing', reconnectedRoom)
					return client.reserveOpenSeat(reconnectedRoom, sessionId, nodeTime).return(reconnectedRoom)
				}

				//check for available already created rooms
				return client.availableRoomsByPath(roomOrPath)//path
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
				return client.syncRoomCounts(roomReserved, nodeTime).return(roomReserved)
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
			.finally(() => {
				//client.quit()
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
	})
}
