const debug         = require('debug')      //https://github.com/visionmedia/debug
debug.log = console.info.bind(console)
const _log          = debug('filterSingleGameRoom')
const _error        = debug('filterSingleGameRoom:err')

const Promise = require('bluebird')
const store	  = require('../../store')

const isGameRoomByType = require('../../util/isGameRoomByType')

const _isEqual = require('lodash/isEqual')
const _find = require('lodash/find')
const _nth = require('lodash/nth')
const _isEmpty = require('lodash/isEmpty')
const _indexOf = require('lodash/indexOf')
const _includes = require('lodash/includes')

const setPendingGameRoom 	= store.getLua('./scripts/redis2/session/setPendingGameRoom.lua')
const getSubscribedGameRooms 	= store.getLua('./scripts/redis2/session/getSubscribedGameRooms.lua')
const unsubscribe 			= Promise.method(require('../jobs/unsubscribe'))

const _size = require('lodash/size')
const _has = require('lodash/has')
const _get = require('lodash/get')

const validateIntendedGameRoom = Promise.method(function(rawData){
	const {db, sessionId, roomList, intendedRoom} = rawData
	const foundRoom = _nth(_find(roomList, ([roomType, roomName,]) => _isEqual(roomName, intendedRoom) && isGameRoomByType(roomType)),1)
	if(!_isEmpty(foundRoom)){
		return db.setPendingGameRoom(sessionId, foundRoom)
			.return({...rawData})
			.catchReturn({...rawData, intendedRoom: false})
	} else {
		return Promise.resolve({...rawData, intendedRoom: false})
	}
})

const filterGameRoomsFromDb = Promise.method(function(rawData){
	const {db, sessionId, roomList} = rawData
	return db.getSubscribedGameRooms(sessionId, 'SKIPPENDING')
		.then((rooms) => (_size(rooms) > 0) ? unsubscribe({db, data:{sessionId, rooms}}).return(rooms).catchReturn(rooms): [])
		.then((unsubRooms) => Promise.filter(roomList, ([,roomName,]) => !_includes(unsubRooms, roomName)))	//filter out the unsub list from original room list
		.then((rooms) => ({...rawData, roomList: rooms}))
})

module.exports = function(rawData){
	let db = _get(rawData, 'db')

	//no intended room, continue on.
	if(!db) return Promise.reject(new Error('NO DB'))
	if(!_has(rawData,'intendedRoom')) return Promise.resolve(rawData)

	db.defineCommand('setPendingGameRoom', {numberOfKeys: 2, lua: setPendingGameRoom})
	db.defineCommand('getSubscribedGameRooms', {numberOfKeys: 1, lua: getSubscribedGameRooms})

	return validateIntendedGameRoom(rawData)
		.then(filterGameRoomsFromDb)
		.tapCatch(_error)
		.catchThrow(new Error('INVALID FILTER GAME ROOM'))
}
