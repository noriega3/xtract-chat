"use strict"
const debug         = require('debug') //https://github.com/visionmedia/debug
let _log          = debug('bot')
const Promise       = require('bluebird')
const globals       = require('../../globals')
const redisManager  = require('../../scripts/redis_manager')
const client        = redisManager.client
const roomActions 	= require('../../scripts/room/shared')
const SubClient = require('./subscriber')
const helper = require("../../utils/helpers")

const getRandomUserName = () => client.srandmember('bots|usernames')
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
const getAvailableUserId = () => client.incr('bots|nextId')

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

			}
		})

		bot.on('uncaughtException', function(err){
			_log('err on bot', err.toString())
		})
		return bot
	})

}

module.exports = Bot

//reset on server boot
client.set('bots|nextId', 50000)
client.sadd('bots|usernames', "Not You", "Player202020", "player 50", "Android Guy", "Guy", "You")
