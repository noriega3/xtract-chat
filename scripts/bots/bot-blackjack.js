"use strict"
const debug     = require('debug') //https://github.com/visionmedia/debug
debug.log = console.info.bind(console) //one all send all to console.

const _         = require('lodash') //https://github.com/visionmedia/debug

const Promise   = require('bluebird')
const store     = require('../../store')
const withDatabase		= store.database.withDatabase
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
		bot._log = debug(`bot:init`)
		bot._error = debug(`bot:init:err`)

		bot.on('init', function(data){
			bot.sessionId = data.response.sessionId
			bot._log = debug(`bot:${bot.sessionId}`)
			bot._error = debug(`bot:${bot.sessionId}:err`)
			bot.reserveRoom(roomName, params)
		})

		bot.on('reservation', function(data){
			roomName = data.roomName
		})

		bot.on('subscribed', function(data){
			if(data.room === roomName && bot.sessionId === data.response.sessionId){
				bot.connectedRoom = roomName
				params.room = roomName
				params.roomUpdates = 0
			}
		})

		bot.on('roomUpdate', function(data){
			if(!data.response){ return }
			if(data.room !== bot.connectedRoom) { return }
			params.roomUpdates++

			const response = data.response
			const messageId = response.messageId
			const roomData = response.roomData
			const matchData = response.matchData
			const matchState = matchData.matchState
			//First update for bot
			if(params.roomUpdates === 1){
				//get this bot's seat
				let pdata = _.findLast(response.players, function(o){ return o.sessionId === bot.sessionId })
				if(!pdata){ return bot._log('no playerData found') }
				params.playerData = pdata
				params.seatIndex = pdata.seatIndex
			}

			const matchPublish = (eParams) => {
				const message = {
					sessionId: bot.sessionId,
					userId:	props.userId,
					roomName: roomName,
					appName: roomArr.roomAppName,
					intent: "sendMatchEvent",
					room:roomName,
					params: eParams
				}
				bot._log('publishing bot message', message)
				return bot.publish(message)
			}

			switch(matchState){
				case 'OPT_IN':
					const optIns = matchData.optIns[matchData.matchId-1]
					if(!params.isOptIn && optIns && optIns.length > 0){
						params.isOptIn = true

						matchPublish({
							event: "setOptIn",
							lastMessageId: messageId,
							matchId: matchData.matchId,
							sessionId: bot.sessionId,
							seat: params.seatIndex,
							seatProps: {
								matchId: matchData.matchId,
								sessionId: bot.sessionId,
								seatIndex: params.seatIndex,
								wager: 5
							}
						})
					}
					break
				case 'CANCELLED':
				case 'COMPLETE':
					params.isOptIn = false
					break
			}
		})

		bot.on('uncaughtException', function(err){
			bot._error('err on bot', err.toString())
		})
		return bot
	})

}

module.exports = Bot
