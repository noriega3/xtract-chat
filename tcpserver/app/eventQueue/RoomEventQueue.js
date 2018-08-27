"use strict"
const debug		= require('debug') //https://github.com/visionmedia/debug
debug.log = console.info.bind(console)
const _log 		= debug("roomQ")
const _error	= debug("roomQ:err")

_log('created new instance', process.title)

const Promise       = require('bluebird')

const store			= require('../store')
const queues		= store.queues
const Queue 		= require('../scripts/queue')

const _identifier 	= 'roomQueue'

const isJson = require('../util/isJson')
const fromJson = require('../util/fromJson')

const turnBasedActions 	= require('../scripts/room/turnbased')
const roomEvents    = require('../scripts/room/events')

const addConfig = {
    attempts: 1,
	timeout: 3000,
	removeOnComplete: false,
}
const RoomActions 	= require('../scripts/room/shared')

const RoomEventQueue = function(){
	const _queue = Queue(_identifier)

	//roomSubQueue.setMaxListeners(0)
	_queue.process('*',10, 'scripts/jobs/rooms.js')

	_queue.process('sendChatToRoom', (job) => {
		const data = job.data
		const serverTime = Date.now()

		return client.sendChatToRoom(data.sessionId, data.room, data.message, data.eventId, serverTime)
			.then((results) => {
			})
			.catch((err) => {
				_error('[Error Chat]', err)
			})
	})

	//for server controlled events
	_queue.process('sendServerRoomEvent', (job, done) => {
		const data = job.data
		done(null, 'OK')
	})

	//acknowledgement that player received the server room event message
	_queue.process('receivedServerRoomEvent', (job, done) => {
		const data = job.data
		done(null, 'OK')
	})


	_queue.process('prepareSyncSessionData', (job) => {
		const data          = job.data
		const sessionId     = data.sessionId
		const prepParams    = data.params
		const eventId       = prepParams.eventId
		const eventParams   = prepParams.params
		const username          = eventParams.username
		const score             = eventParams.score
		const level             = eventParams.level
		const subCurrency       = eventParams.subCurrency
		const avatar            = eventParams.avatar
		const auth              = eventParams.auth
		const forceRoomUpdate   = eventParams.forceRoomUpdate
		const paramsMsg         = JSON.stringify(eventParams)
		const serverTime 		= Date.now()

		const validateAuths = () => {
			return client.validateAuths(sessionId, auth).then((result) => result)
		}

		const validateString = (item) => {
			if (!item || typeof(item) !== "string") {
				throw new Error('invalid string')
			}
			return true
		}

		const validateNumber = (item, min, max) => {
			if(!item || typeof(item) !== "number"){ throw new Error('invalid number')}
			if(min && item < min){ throw new Error('invalid number')}
			if(max && item > max){ throw new Error('invalid number')}
			return true
		}

		return Promise.all([
				validateAuths(),
				validateString(username),
				validateString(avatar),
				validateNumber(score),
				validateNumber(level),
				validateNumber(subCurrency)
			])
			.then((result) => client.prepareRoomEvent(sessionId, "sessions:" + sessionId, eventId, 'syncSessionData', serverTime, paramsMsg, 'sendRoomEvent', 'syncSessionDataResponse'))
			.then((result2) => {
			})
		/*        .catch((err) => {
                })*/
	})

	_queue.process('syncSessionData', (job) => {
		const data              = job.data
		const sessionId         = data.sessionId
		const forceRoomUpdate   = data.forceRoomUpdate

		return client.updateSessionData(sessionId,
			'username', data.username,
			'score', data.score,
			'avatar', data.avatar,
			'level', data.level,
			'subCurrency', data.subCurrency
			)
			.tap((result) => {
				if(forceRoomUpdate){
					return RoomActions.getGameRoomBySessionId(sessionId)
						.then(RoomActions.commandPublishGameRoomUpdate)
				}
			})
			.then((results) => {
			})
		/*        .catch((err) => {
                    _error('[Error Sync]', err)
                    _log('err on sync '+err.toString())
                })*/
	})

	_queue.process('prepareRoomEvent', (job) => {
		const data = job.data.params
		const eventId       = data.eventId
		const roomName      = data.room
		const sessionId     = data.sessionId
		const eventTable    = data.params
		const eventName        = eventTable.event
		const eventParams      = eventTable.data
		const serverTime = Date.now()

		//we process the function in, then when user verifies our send back,
		//we post the results to the specified room

		let validateEvent = () => {
			const eventFunctName = "_"+eventName
			if (!eventName || typeof(eventName) !== "string" || (typeof roomEvents[eventFunctName] === 'undefined')) {
				throw new Error('invalid event name')
			}
			return roomEvents[eventFunctName](sessionId, eventParams)
				.then((eventResponse) => {
					return client.prepareRoomEvent(sessionId, roomName, eventId, eventName, serverTime, JSON.stringify(eventResponse), 'sendRoomEvent', 'receiveRoomEvent')
				})
		}

		return Promise.all([
			validateEvent()
		]).then((results) => {
		})
		/*    .catch((err) => {
            })*/
	})

	_queue.process('verifyRoomEvent', (job) => { //verifies an eventId for room queue processing.
		const data = job.data
		const serverTime = Date.now()

		const sessionId = data.sessionId
		const eventId   = data.eventId

		return client.verifyRoomEvent(sessionId, eventId, serverTime)
			.then((jsoned) => {
				let eventName = eventId.split('|')[1]

				let parsed = jsoned && _isJson(jsoned) ? JSON.parse(jsoned) : {}
				if(!eventName) throw new Error('no event name found')

				_log('-----event found -0---')
				_log(eventName)
				_log(parsed)
				_log('-----###event found -0---')
				return [eventName, parsed]
			})
			.then((results) => {
			})
		/*        .catch((err) => {
                })*/
	})

	//Turn based rooms use match logic as well as overall room events
	_queue.process('sendMatchEvent', (job) => {
		const data = job.data
		const sessionId 	= data.sessionId
		const room 			= data.room
		const params 		= data.params || {}

		return client.checkSessionState(sessionId)
			.tap((result) => _log('[MATCH] Session State', result.toString()))

			//Forward event to turn based file to execute
			.then(() => turnBasedActions.processEvent(sessionId, room, params))
			.tap((result) => _log('[MATCH] Process Event', result.toString()))

			.then(() => 'OK')

			//On error, we unsubscribe user immediately TODO: switch to 3rd retry
			.tapCatch(() => {
				_log('unsubscribing')
				return _queue.add('unsubscribe', {sessionId: sessionId, roomName: room}, addConfig)
			})
			.catch((err) => {
				_error('[Error Match Event]', err.status, err.message)
				console.log(err, err.stack.split("\n"))

				if(err.message === "NO SESSION"){
					//todo: fail the room
				}

				throw new Error('Match Event Error '+ err.toString())
			})
	})

	//Clean up the onPlayerSub/Unsubs when many people join at the same time.
	_queue.on('stalled', function(job){
		const jobId = job.jobId
		_error("job is stalled", jobId)
	})

	_queue.on('error', function(error){
		console.log('err @ roomQueue')
		console.log(error)
		_queue.clean(0)
	})

	//Clean up the onPlayerSub/Unsubs when many people join at the same time.
	_queue.on('completed', function(job){
		job.remove()
		_queue.clean(0)
	})

	return queues.addQueue(_identifier, {
		getName(){ return _identifier },
		getQueue(){ return _queue }
	})
}

//singleton
exports = module.exports = RoomEventQueue
