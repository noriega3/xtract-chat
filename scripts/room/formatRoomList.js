"use strict"
const debug         = require('debug')      //https://github.com/visionmedia/debug
debug.log = console.info.bind(console) //one all send all to console.
const _log          = debug('formatRoomList')
const _error        = debug('formatRoomList:err')
const Promise		= require('bluebird')

const _isEqual	= require('lodash/isEqual')
const _size		= require('lodash/size')
const _isArray	= require('lodash/isArray')
const _inRange	= require('lodash/inRange')
const _isString	= require('lodash/isString')
const _toInteger	= require('lodash/toInteger')

const {
	getSubscriptionsBySessionId
} = require('../room')

const store = require('../../store')
const getConnection = store.database.getConnection
const jsonParseAsync = Promise.method(JSON.parse);

const validateRoomData = ([roomTypeId, roomName]) => {
	if(_isEqual('GET', roomTypeId)) return getValidRoomData(roomName)
	return Promise.using(getConnection(), (client) =>
		client.checkRoomTypeMatch(roomName, roomTypeId).return([roomTypeId, roomName])
	)
}

const getValidRoomData = (roomDataOrName) => {
	if(_isArray(roomDataOrName) && _isEqual(_size(roomDataOrName), 3)){
		return validateRoomData(roomDataOrName)
	}
	if(!_isString(roomDataOrName)) throw new Error('INVALID ROOM FORMAT')

	return Promise.using(getConnection(), (client) =>
		client.getRoomInfo(roomDataOrName, 'roomTypeId')
			.tap((result) => { _log('roomTypeId', result)})
			.then(jsonParseAsync)
			.get('roomTypeId')
			.then(_toInteger)
			.tap((result) => { _log('roomTypeId result after parse', result)})
			.then((roomTypeId) => [roomTypeId, roomDataOrName, {}]))
}

module.exports = (rawRoomList) => {

	//TODO: match roomList like subscribe
	//TODO: - roomList = [[type, roomName, unsubParams],[type, anotherRoomName, unsubParams]]
	//TODO: - roomList = [roomName, anotherRoomName] (currently)

	return Promise.reduce(rawRoomList, (filteredList, roomDataOrName) =>
			getValidRoomData(roomDataOrName)
				.then((data) => filteredList.push(data))
				.return(filteredList)
				.catchReturn(filteredList)
		,[])
		.tap((result) => {
			_log('End filter', result)
		})
}
