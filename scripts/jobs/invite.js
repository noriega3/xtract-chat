const debug         = require('debug') //https://github.com/visionmedia/debug
const _log          = debug('subJob')
const _error        = debug('errorSubJob')
const store			= require('../../store')
const db			= store.database

const _includes 	= require('lodash/includes')

const RoomActions 	= require('../room/shared')
const unsubscribe	= require('./unsubscribe')
_log('created new instance')

process.title = _includes(process.title, '/bin/node')? 'node_invite' : process.title

module.exports = (job) => {
	const client        = db.createConnection('jobInvite')

	const data = job.data
	const skipSessionCheck = data.skipSessionCheck
	const sessionId 	= data.sessionId
	let roomList 		= data.rooms ? data.rooms : []
	let params 			= data.params || {}

	//append individual room
	if(data.room){
		let roomType = 0 //default
		roomType = params.isSystem ? -1 : roomType
		roomType = params.isGameRoom ? 1 : roomType
		roomType = params.isTurnBased ? 2 : roomType
		roomList.push([roomType, data.room, params])
	}

	//check if room list is empty
	if(roomList.length <= 0){
		_log('[SUB] roomList empty!')
		return 'EMPTY'
	}

	//Check if session is active
	return client.checkSessionState(sessionId, Date.now(), JSON.stringify({skipSessionCheck}))
		//.tap((result) => _log('[SUB] State', result.toString()))

		//Filter any duplicate game rooms passed in.
		.then(() => RoomActions.filterMultipleGameRooms([sessionId, roomList, data.room])) //returns [sessionId, roomList] filtered
		//.tap((result) => _log('[SUB] Filter Multi', result.toString()))

		//Check if reservation for room based on room type
		.then(RoomActions.filterReservations) //returns [sessionId, roomList] filtered
		//.tap((result) => _log('[SUB] Filter Reserve', result.toString()))

		//Check if user is already in the rooms passed in and filter out
		.then(RoomActions.filterExistingSubs) //returns [sessionId, roomList] filtered

		//check if we need to create room
		.then(RoomActions.setupRooms) //returns [sessionId, roomList] creates any non existing rooms
		//.tap((result) => _log('[SUB] Setup', result.toString()))

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
}
