"use strict"
const fs            = require('fs') //https://github.com/visionmedia/debug
const debug         = require('debug') //https://github.com/visionmedia/debug
const gcm			= require('node-gcm')
const _log          = debug('queue_ps_rooms')
const helper        = require('../../util/helpers')
const store			= require('../../store')

const config		= require('../../config.json')
let notifier		= new gcm.Sender(config.gcmSenderId);

const db			= store.database
const realTime = {}

realTime.processEvent = (sessionId, room, params) =>{
	const eventName = params.event

	switch(eventName){
		default:
			return false
	}
}

realTime.processTickEvent = (room, serverTime, nextMessageId) => {
	let client = db.createConnection('processTickEvent')
	return client.publishRoomUpdate(room)
}


realTime.findNotifyTokenBySessionId = (sessionId) => db.call('hget', [`sessions|${sessionId}`, 'notifyDeviceToken'])

realTime.sendNotifyToRoom = (room, message) => {
	let client = db.createConnection('sendNotifyToRoom')
	let multi = client.multi()
	return db.call('hexSearch', ['hex|sessions:rooms', true, 'ops', room, 'is-sub-of'])
		.map((sessionId) => {
			return multi.hget(`sessions|${sessionId}`, 'notifyDeviceToken')
		})
		.then((searches) => multi.exec())
		.map(([err, tokenId]) => tokenId)
		.then((tokens) => {
			const message = new gcm.Message()
			message.addNotification('title', message)
			notifier.send(message, { registrationTokens: tokens }, function (err, response) {
				if(err) console.error(err)
				else _log(response)
			})
		})
		//.finally(() => client.quit())
		.catch((err) => {
			_log('error on send notify')
			return err.toString()
		})
}

//https://developers.google.com/games/services/common/concepts/realTimeMultiplayer

/* server helpers */
realTime.getRoomState = (roomName) => {
	const roomInfoKey = `rooms|${roomName}|info`
	_log('room state', roomInfoKey)
	return db.call('hget', [roomInfoKey, 'roomState'])
}
realTime.getRoomData = (roomName) => {
	const roomInfoKey = `rooms|${roomName}|info`
	_log('room data', roomInfoKey)
	return db.call('hgetall', [roomInfoKey]) //TODO: get specific data only.
}

/* ========================================================================= */

module.exports = realTime
