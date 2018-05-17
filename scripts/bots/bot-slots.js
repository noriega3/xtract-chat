"use strict"
const debug         = require('debug') //https://github.com/visionmedia/debug
let _log          = debug('botSlots')
const Promise       = require('bluebird')
const store  = require('../../store')
const withDatabase = store.database.withDatabase
const SubClient = require('./bot')
const helper = require("../../util/helpers")

const getRandomUserName = () => {
	return withDatabase((client) => client.srandmember('bots|usernames'))
}
const getRandomScore = () => {
	const min = Math.ceil(1000)
	const max = Math.floor(100000)
	return Math.floor(Math.random() * (max - min)) + min //The maximum is exclusive and the minimum is inclusive
}
const getRandomAvatar = () => {
	const min = Math.ceil(1)
	const max = Math.floor(100)
	return Math.floor(Math.random() * (max - min)) + min //The maximum is exclusive and the minimum is inclusive
}
const getAvailableUserId = () => {
	return withDatabase((client) => client.incr('bots|nextId'))
}
function Bot(roomName, params) {
	const roomArr = helper._roomNameToArr(roomName)

	return Promise.props({
		"username": getRandomUserName(),
		"score": getRandomScore(),
		"avatar": getRandomAvatar(),
		"appName": roomArr.roomAppName,
		"userId": getAvailableUserId(),
		"bot": true
	}).then((props) => {
		const bot = new SubClient(props)

		bot.on('init', function(data){
			bot.sessionId = data.response.sessionId
			_log = debug('bot:'+bot.sessionId)

			bot.reserveRoom(roomName, params)
		})

		bot.on('reservation', function(data){
			roomName = data.roomName
		})

		bot.on('subscribed', function(data){
			if(data.room === roomName){
				bot.connectedRoom = roomName

				params.room = roomName
				const message = {
					sessionId: bot.sessionId,
					userId:	props.userId,
					roomName: roomName,
					appName: roomArr.roomAppName,
					intent: "sendChatToRoom",
					room:roomName,
					message: "Hey!"
				}

				bot.publish(message)
			}
		})

		bot.on('uncaughtException', function(err){
			_log('err on bot', err.toString())
		})
		return bot
	})

}

module.exports = Bot
