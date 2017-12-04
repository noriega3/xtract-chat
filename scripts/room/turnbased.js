"use strict"
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


turnBased.processEvent = (sessionId, room, params) =>{
	const eventName = params.event

	switch(eventName){
		case 'optIn':
			return client.setMatchOptInSession(room, sessionId)
		case 'optOut':
			return client.setMatchOptOutSession(room, sessionId)
		case 'takeTurn':
			return client.setMatchTakeTurn(room, sessionId, params)
		default:
			return false
	}
}

turnBased.processTickEvent = (room, serverTime, nextMessageId) =>{

	let roomArr = JSON.stringify(helper._roomNameToArr(room))
	const matchStateKey = helper._bar('rooms', room, 'matchState')

	return client.lindex(matchStateKey, 0)
		.then((matchState) => {
			if(matchState) {

				switch(matchState){

					case 'NEW_MATCH':
						return client.setNewMatch(room)
					case 'OPT_IN': //GPGS - AUTO_MATCHING
						return client.checkMatchOptIns(room)
					case 'ACTIVE':
						return client.checkMatchActive(room)
					case 'CANCELLED':
						return client.destroyTurnBasedGameRoom(room,roomArr)
					case 'COMPLETE':
						//period where user waits until opt in begins.
						return client.setMatchComplete(room)
					default:
						return room
				}

				//}
			} else {
				return room
			}
		})
		.tap((results) => _log('[Results]', results))
		.then((results) => client.publishMatchUpdate(room))
}



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
/*turnBased.takeTurn = (roomName, sessionId) => {

}*/


client.defineCommand('takeTurn', {
	numberOfKeys: 3,
	lua: fs.readFileSync("./scripts/redis/rooms/turnbased/match/takeTurn.lua", "utf8")
})

client.defineCommand('setMatchOptInSession', {
	numberOfKeys: 2,
	lua: fs.readFileSync("./scripts/redis/rooms/turnbased/match/setMatchOptInSession.lua", "utf8")
})

client.defineCommand('setMatchOptOutSession', {
	numberOfKeys: 2,
	lua: fs.readFileSync("./scripts/redis/rooms/turnbased/match/setMatchOptOutSession.lua", "utf8")
})

client.defineCommand("checkMatchActive", {
	numberOfKeys: 1,
	lua: fs.readFileSync("scripts/redis/rooms/turnbased/match/checkMatchActive.lua", "utf8")
})

client.defineCommand("checkMatchOptIns", {
	numberOfKeys: 1,
	lua: fs.readFileSync("scripts/redis/rooms/turnbased/match/checkMatchOptIns.lua", "utf8")
})

client.defineCommand("publishMatchUpdate", {
	numberOfKeys: 1,
	lua: fs.readFileSync("scripts/redis/rooms/turnbased/match/publishMatchUpdate.lua", "utf8")
})

client.defineCommand("setMatchComplete", {
	numberOfKeys: 1,
	lua: fs.readFileSync("scripts/redis/rooms/turnbased/match/setMatchComplete.lua", "utf8")
})

client.defineCommand("setNewMatch", {
	numberOfKeys: 1,
	lua: fs.readFileSync("scripts/redis/rooms/turnbased/match/setNewMatch.lua", "utf8")
})

client.defineCommand("setMatchTakeTurn", {
	numberOfKeys: 1,
	lua: fs.readFileSync("scripts/redis/rooms/turnbased/match/setNextTurn.lua", "utf8")
})

module.exports = turnBased
