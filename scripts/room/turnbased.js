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
const turnBased = {}

// Set up the sender with you API key


turnBased.findNotifyTokenBySessionId = (sessionId) => client.hget(helper._bar('sessions', sessionId), 'notifyDeviceToken')

turnBased.sendNotifyToRoom = (room, message) => {
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

//https://developers.google.com/games/services/common/concepts/turnbasedMultiplayer

/* server helpers */
turnBased.getMatchState = (roomName) => {
	const roomInfoKey = helper._bar('rooms', roomName, 'info')
	_log('match state', roomInfoKey)
	return client.hget(roomInfoKey, 'gameState')
}
turnBased.getMatchData = (roomName) => {
	const roomInfoKey = helper._bar('rooms', roomName, 'info')
	_log('matchdata', roomInfoKey)
	return client.hgetall(roomInfoKey)/*, 'gameState', 'gameHash', 'gamePlayers', 'playerTurn', 'gamesPlayed')*/
}
turnBased.setMatchState = (roomName, state) => {
	//AUTO_MATCHING, ACTIVE, COMPLETE, CANCELLED, EXPIRED
}

/* server side actions */
turnBased.sendGameData = (roomName, data) => {

}

turnBased.sendNotifyPlayerTurn = (roomName, playerIndex) => {

}

turnBased.sendMatchNotification = (roomName, notification) => {
	turnBased.sendNotifyToRoom(roomName, 'Waiting for players..')
}

/* server side receivers from client */
turnBased.receivedSuccess = (roomName, messageId, sessionId) => {

}
turnBased.receiveTurnData = (roomName, data) => {

}


/* ========================================================================= */

/* client helpers */

/* client side actions */
turnBased.takeTurn = (roomName, sessionId) => {

}





module.exports = turnBased
