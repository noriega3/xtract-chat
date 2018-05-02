"use strict"
const debug         = require('debug') //https://github.com/visionmedia/debug
debug.log = console.info.bind(console) //one all send all to console.
const _log          = debug('subscribe')
const _error        = debug('subscribe:err')

const Promise		= require('bluebird')
const store			= require('../../store')
const withDatabase	= store.database.withDatabase

const RoomActions 	= require('../room/shared')
const unsubscribe	= require('./unsubscribe')

const _get			= require('lodash/get')

const getRoomTypeFromParams = require('../../util/getRoomTypeFromParams')

_log('created new instance')
module.exports = (job) => {
	_log('here in subscribe', job.data)
	const data = job.data
	const skipInitCheck = data.isInit
	const sessionId 	= data.sessionId
	let roomList 		= data.rooms || []
	let params 			= data.params || {}
	let intendedRoom 	= _get(data, 'room', _get(data, 'roomName', false))

	//append individual room
	if(intendedRoom){
		roomList.push([
			getRoomTypeFromParams(params),
			intendedRoom,
			params])
	}
	_log('rooomlist', roomList)

	//check if room list is empty
	if(roomList.length <= 0){
		_log('[SUB] roomList empty!')
		return 'EMPTY'
	}

	return withDatabase((client) => {

		//Check if session is active
		return client.checkSessionState(sessionId, Date.now(), JSON.stringify({skipInitCheck}))
			//.tap((result) => _log('[SUB] State', result.toString()))

			//Filter any duplicate game rooms passed in.
			.then(() => RoomActions.filterMultipleGameRooms([sessionId, roomList, intendedRoom])) //returns [sessionId, roomList] filtered
			//.tap((result) => _log('[SUB] Filter Multi', result.toString()))

			//Check if reservation for room based on room type
			.then(RoomActions.filterReservations) //returns [sessionId, roomList] filtered
			.tap((result) => _log('[SUB] Filter Reserve', result.toString()))

			//Check if user is already in the rooms passed in and filter out
			.then(RoomActions.filterExistingSubs) //returns [sessionId, roomList] filtered

			//check if we need to create room
			.then(RoomActions.setupRooms) //returns [sessionId, roomList] creates any non existing rooms
			.tap((result) => _log('[SUB] Setup', result.toString()))

			//Remove session from any existing game rooms
			.then(RoomActions.checkForGameRoomsAndUnSub)
			.tap((result) => _log('[SUB] Remove From Existing', result.toString()))

			//Subscribes to rooms and passes in params from job.
			.then(RoomActions.subToRooms) //subscribes to rooms
			.tap((result) => _log('[SUB] Sub', result.toString()))

			.then((result) => result)

			.tapCatch(() => unsubscribe({data:{sessionId: sessionId, rooms: roomList}}))
			.finally(() => {
				//client.quit()
			})
			.catch((err) => {
				_error('[Error Subscribe]', err.status, err.message)
				console.log(err, err.stack.split("\n"))

				if(err.message === "NO SESSION"){
					//todo: fail the room
				}

				throw new Error('Subscribe Error '+ err.toString())
			})
	})
}
