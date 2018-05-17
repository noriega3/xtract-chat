"use strict"
const debug         = require('debug')      //https://github.com/visionmedia/debug
debug.log = console.info.bind(console) //one all send all to console.
const _log          = debug('filterValidSubs')
const _error        = debug('filterValidSubs:err')

const Promise		= require('bluebird')

const _isEqual = require('lodash/isEqual')
const _size = require('lodash/size')
const _isArray = require('lodash/isArray')
const _some = require('lodash/some')

const store = require('../../store')

const checkIsSubscribed = store.getLua("./scripts/redis2/session/validators/checkIsSubscribed.lua")

const getSubscriptionsBySessionId = require('./getSubscriptionsBySessionId')

const checkValidRoomSubscription = Promise.method(function(data){
	const {db, sessionId, roomName} = data
	/** @function db.checkIsSubscribed */
	db.defineCommand('checkIsSubscribed', {	numberOfKeys: 2, lua: checkIsSubscribed })

	return db.checkIsSubscribed(sessionId, roomName)
		.tap((result) =>{ _log('check is subbed', result)})
		.then((result) => _isEqual('SUBSCRIBED',result))
		.catchThrow(new Error('INVALID ROOM'))
})

module.exports = function(data){
	const {db,sessionId, roomList} = data
	if(!_isArray(roomList)) throw new Error('EMPTY ROOM LIST')

	_log(sessionId, roomList)

	if(_size(roomList) <= 5)
		return Promise.reduce(roomList, (filteredList, roomData) => {
			const [,roomName] = roomData
			return checkValidRoomSubscription({db, sessionId, roomName})
				.then(() => (filteredList.push(roomData)))
				.return(filteredList)
				.catchReturn(filteredList)
		},[])
		.then((roomList) => ({...data, roomList}))
	else if(_size(roomList) > 5)
		return getSubscriptionsBySessionId({db, sessionId})
			.tap((sessionSubscriptions) => {
				_log('subs of session return', sessionSubscriptions,'|', roomList)
			})
			.then((sessionSubscriptions) => {
				_log('subs', sessionSubscriptions)
				_log('csubs', roomList)
				return roomList
			})
			.filter(([, roomNameDb]) => _some(roomList, ([,roomNameClient]) => _isEqual(roomNameClient, roomNameDb)))
			.then((roomList) => ({...data, roomList}))
			.tapCatch((err) => {_error('[Error CheckSessionSubs]', err)})
			.catchThrow(new Error('INVALID SUBSCRIPTIONS'))
	else
		throw new Error('INVALID SUBSCRIPTIONS')
}
