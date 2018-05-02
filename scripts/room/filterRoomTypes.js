"use strict"
const debug         = require('debug')      //https://github.com/visionmedia/debug
debug.log = console.info.bind(console) //one all send all to console.
const _log          = debug('filterRoomTypes')
const _error        = debug('filterRoomTypes:err')
const Promise		= require('bluebird')
const _isEqual = require('lodash/isEqual')
const _inRange = require('lodash/inRange')
const {
	getSubscriptionsBySessionId
} = require('../room')

const store = require('../../store')
const getConnection = store.database.getConnection

const checkValidRoomType = (roomType) => (!roomType || !_inRange(roomType, -1,2))


	module.exports = ([sessionId, roomList]) => {

	//TODO: match roomList like subscribe
	//TODO: - roomList = [[type, roomName, unsubParams],[type, anotherRoomName, unsubParams]]
	//TODO: - roomList = [roomName, anotherRoomName] (currently)

	return Promise.map((roomList, ([roomType, roomName, roomParams]) => {
		if(checkValidRoomType(roomType)) return [roomType, roomName, roomParams]

		return Promise.using(getConnection(), (client) => {
			//get room id if exisitng, otherwise, remove from array
		})

	}))

	if(_isEqual(roomList.length,1)) {
		return Promise.using(getConnection(), (client) => {
			return client.checkIsSubscribed(sessionId, roomList[0])
				.then((result) => {
					_log('subscribed, so keep', result)
					if(_isEqual('SUBSCRIBED',result))
						return [sessionId, roomList, removeEmptyRooms]
					else
						return [sessionId, [], removeEmptyRooms]
				})
		})
		.catch((err) => {
			_error('[Error CheckSessionSubs]', err)
			throw new Error(err)
		})
	} else {
		//uses the array from the db, as it has the type already defined.
		return getSubscriptionsBySessionId([sessionId])
		.tap((rooms) => _log('subs of session return', rooms,'|', roomList))
			.filter(([, roomName]) => roomList.includes(roomName))
			.then((filteredList) => [sessionId, filteredList, removeEmptyRooms])
			.tap((rooms) => _log('filtered of subscriptions db', rooms,'|', roomList))
			.catch((err) => {
				_error('[Error CheckSessionSubs]', err)
				throw new Error(err)
			})
	}
}
