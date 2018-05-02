"use strict"
const fs            = require('fs') //https://github.com/visionmedia/debug
const debug         = require('debug') //https://github.com/visionmedia/debug
const _log          = debug('queue_ps_rooms')
const helper          = require('../../util/helpers')
const store			= require('../../store')
const db = store.database
const turnBased = {}

turnBased.processEvent = (sessionId, room, params) =>{
	const eventName = params.event

	switch(eventName){
		case 'setOptIn':
			if(!params.seatProps) throw new Error('NO OPT IN PROPS')
			return db.call('setMatchOptInSession', [room, sessionId, JSON.stringify(params)])
		case 'setOptOut':
			return db.call('setMatchOptOutSession', [room, sessionId, JSON.stringify(params)])
		case 'setMatchTakeTurn':
			return db.call('setMatchTakeTurn', [room, sessionId, JSON.stringify(params)])
		case 'setMatchProp':
			return db.call('setMatchProp', [room, sessionId, JSON.stringify(params)])
		case 'setSeatProps':
			return db.call('setMatchSeatProps', [room, sessionId, JSON.stringify(params)])
		default:
			return false
	}
}

turnBased.processTickEvent = (room) =>{
	let roomArr = JSON.stringify(helper._roomNameToArr(room))
	const matchStateKey = helper._bar('rooms', room, 'matchState')
	let client = db.createConnection('turnBasedTick')

	return client.lindex(matchStateKey, 0)
		.then((matchState) => {
			if(matchState) {

				switch(matchState){

					case 'OPT_IN': //GPGS - AUTO_MATCHING
						return client.checkMatchOptIns(room)
					case 'ACTIVE':
						return client.checkMatchActive(room)
					case 'CANCELLED':
						return client.destroyTurnBasedGameRoom(room,roomArr)
					case 'COMPLETE':
						//period where user waits until opt in begins.
						return client.setNewMatch(room, true)
					default:
						return room
				}

				//}
			} else {
				return room
			}
		})
		//.tap((results) => _log('[Results]', results))
		.then((results) => client.publishTurnBasedUpdate(room))
		/*.finally(() => client.quit())*/
		//.tap((results) => _log('[Results]', results))
}



turnBased.findNotifyTokenBySessionId = (sessionId) => {
	return db.call('hget',[helper._bar('sessions', sessionId), 'notifyDeviceToken'])
}

turnBased.sendNotifyToRoom = (room, message) => {
	const client = db.createConnection('sendNotifyToRoom')
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
		/*.finally(() => client.quit())*/
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
	return db.call('hget',[roomInfoKey, 'matchState'])
}
turnBased.getMatchData = (roomName) => {
	const roomInfoKey = helper._bar('rooms', roomName, 'info')
	_log('matchdata', roomInfoKey)
	return db.call('hgetall',[roomInfoKey]) /*, 'gameState', 'gameHash', 'gamePlayers', 'playerTurn', 'gamesPlayed')*/
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
/*turnBased.takeTurn = (roomName, sessionId) => {

}*/


module.exports = turnBased
