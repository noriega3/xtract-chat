"use strict"
let apm = require('elastic-apm-node')

const debug = require('debug')
debug.log = console.info.bind(console) //one all send all to console.
const _log = debug('botsProcess')
const _error = debug('botsProcess:error')

const Promise  = require('bluebird')
const store  = require('../../store')
const withDatabase  = store.database.withDatabase

const getRoomTypeFromParams = require('../../util/getRoomTypeFromParams')

const _isInteger = require('lodash/isInteger')
const _isEqual = require('lodash/isEqual')

const Bot = require('../bots')

/***
 *
 * @param roomName
 * @returns {*}
 */
const removeBotFromRoom = (roomName) => {
	let roomBotKey, sessionRoom, redisRoomName, serverTime, message
	return withDatabase((connection) => {
		roomBotKey = `rooms|${roomName}|bots`
		return connection.srandmember(roomBotKey)
			.then((sessionId) => {
				if (!sessionId) { return true }

				sessionRoom = `session:${sessionId}`
				redisRoomName = `bot|${sessionId}`
				serverTime = Date.now()

				//send a message to the bot to d/c it.
				message = JSON.stringify({
					sessionId: sessionId,
					phase: 'requestDisconnect',
					room: sessionRoom,
					response: {
						sessionId: sessionId,
						room: roomName,
						time: serverTime
					}
				})
				return connection.publish(redisRoomName, message)
			})
	})
}

/***
 *
 * @param roomName
 * @returns {Bluebird<boolean>}
 */
const removeAllBotsFromRoom = (roomName) => {
	let roomBotKey, sessionRoom, redisRoomName, serverTime, message

	return withDatabase((connection) => {
		roomBotKey = `rooms|${roomName}|bots`
		return connection.smembers(roomBotKey)
			.map((sessionId) => {
				if (!sessionId) { return true }
				sessionRoom = `session:${sessionId}`
				redisRoomName = `bot|${sessionId}`
				serverTime = Date.now()

				//send a message to the bot to d/c it.
				message = JSON.stringify({
					sessionId: sessionId,
					phase: 'requestDisconnect',
					room: sessionRoom,
					response: {
						sessionId: sessionId,
						room: roomName,
						time: serverTime
					}
				})
				return connection.publish(redisRoomName, message)
			})
			.return(true)
	})
}

const addBotToRoom = Promise.method(function(roomName, roomTypeId, roomGame, roomTheme){
	if (_isEqual('lobby', roomTheme)) return Promise.resolve('BOTS NOT ENABLED')
	if(!_isInteger(roomTypeId)) return Promise.reject(new Error('INVALID ROOM TYPE'))

	const params = getRoomTypeFromParams(roomTypeId)
	let bot

	switch (roomGame) {
		case 'blackjack':
			bot = new Bot.blackjack(roomName, params)
			break
		case 'slots':
			bot = new Bot.slots(roomName, params)
			break
		default:
			return Promise.resolve('BOTS NOT ENABLED')
	}

	if (bot) {
		return Promise.resolve('OK')
	} else {
		return Promise.reject('INVALID')
	}
})

module.exports = function(job){

	return withDatabase((db) => {
		const sessionId 		= _get(job, 'data.sessionId')
		const unsubType			= _get(job, 'data.unsubType', 'normal')
		const isDestroy			= _isEqual(unsubType, 'destroy')
		const errorMessage	 	= _isEqual(unsubType, 'error') && _get(job, 'data.error')
		const skipSessionCheck 	= _get(job, 'data.skipSessionCheck', false) || isDestroy || _isEqual(unsubType, 'error')
		let roomList 			= _get(job, 'data.rooms', [])

		const data 			= job.data
		const intent 		= data.intent
		const roomName 		= data.roomName
		const roomTypeId	= data.roomTypeId
		const roomGame 		= data.roomGame
		const roomTheme 	= data.roomTheme

		let findBotCommand = () => {
			switch (intent) {
				case 'remove':
					return removeBotFromRoom(roomName)
				case 'removeAll':
					return removeAllBotsFromRoom(roomName)
				case 'add':
					return addBotToRoom(roomName, roomTypeId, roomGame, roomTheme)
			}
		}

		//process bot command
		return findBotCommand(intent)
			.tap((result) => {_log('[BOT] Command', result)})
			.return('OK')
			.tapCatch((err) => {
				_error('[ERROR BOT]' + err.status, err.message)
				console.log(err, err.stack.split("\n"))
			})
	})
}
