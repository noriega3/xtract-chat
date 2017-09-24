const fs            = require('fs') //https://github.com/visionmedia/debug
const debug         = require('debug') //https://github.com/visionmedia/debug
const cluster       = require('cluster')
const Promise       = require('bluebird')
const gcm			= require('node-gcm')
const _log          = debug('queue_ps_rooms')
const globals       = require('../../globals')
const helper          = require('../../utils/helpers')
const redisManager  = require('../../scripts/redis_manager')
const client        = redisManager.client
const notifier		= new gcm.Sender(***REMOVED***);
const realTime = {}

// Set up the sender with you API key


realTime.findNotifyTokenBySessionId = (sessionId) => client.hget(helper._bar('sessions', sessionId), 'notifyDeviceToken')

realTime.sendNotifyToRoom = (room, message) => {
	let multi = client.multi()
	return client.hexSearch('hex|sessions:rooms', true, 'ops', room, 'is-sub-of')
		.map((sessionId) => {
			return multi.hget(helper._bar('sessions', sessionId), 'notifyDeviceToken')
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
		.catch((err) => {
			_log('error on send notify')
			return err.toString()
		})
}

//https://developers.google.com/games/services/common/concepts/realTimeMultiplayer

/* server helpers */
realTime.getRoomState = (roomName) => {
	const roomInfoKey = helper._bar('rooms', roomName, 'info')
	_log('room state', roomInfoKey)
	return client.hget(roomInfoKey, 'roomState')
}
realTime.getRoomData = (roomName) => {
	const roomInfoKey = helper._bar('rooms', roomName, 'info')
	_log('room data', roomInfoKey)
	return client.hgetall(roomInfoKey) //TODO: get specific data only.
}

/* ========================================================================= */

/* client helpers */

/* client side actions */


module.exports = realTime
