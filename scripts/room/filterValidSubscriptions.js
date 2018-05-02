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
const withDatabase = store.database.withDatabase
const getSubscriptionsBySessionId = require('./getSubscriptionsBySessionId')

const checkValidRoomSubscription = (sessionId, roomName) => {
	return withDatabase((connection) => {
		return connection.checkIsSubscribed(sessionId, roomName)
			.tap((result) =>{ _log('check is subbed', result)})
			.then((result) => _isEqual('SUBSCRIBED',result))
			.catchThrow(new Error('INVALID ROOM'))
	})
}

module.exports = ([sessionId, roomList]) => {
	if(!_isArray(roomList)) throw new Error('EMPTY ROOM LIST')

	if(_size(roomList) < 0)
		return Promise.reduce(roomList, (filteredList, roomData) => {
			const [,roomName] = roomData
			return checkValidRoomSubscription(sessionId, roomName)
				.then(() => filteredList.push(roomData))
				.return(filteredList)
				.catchReturn(filteredList)
		},[]).tap((roomList))
	else if(_size(roomList) > 0)
		return getSubscriptionsBySessionId([sessionId])
			.tap((sessionSubscriptions) => {
				_log('subs of session return', sessionSubscriptions,'|', roomList)
			})
			.then((sessionSubscriptions) => {
				_log('subs', sessionSubscriptions)
				_log('csubs', roomList)
				return roomList
			})
/*			.filter(([, roomNameDb]) => _some(roomList, ([,roomNameClient]) => _isEqual(roomNameClient, roomNameDb)))
			.then((filteredList) => [sessionId, filteredList])*/
			.tap((rooms) => _log('filtered of subscriptions db', rooms,'|', roomList))
			.tapCatch((err) => {_error('[Error CheckSessionSubs]', err)})
			.catchThrow(new Error('INVALID SUBSCRIPTIONS'))
	else
		return Promise.reject(new Error('INVALID SUBSCRIPTIONS'))
}
