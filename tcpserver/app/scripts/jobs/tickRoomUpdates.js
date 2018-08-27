"use strict"


const debug         = require('debug') //https://github.com/visionmedia/debug
debug.log = console.info.bind(console) //one all send all to console.
const _log 			= debug('tickRoomUpdates')
const _error 		= debug('tickRoomUpdates:err')

const Promise		= require('bluebird')

const _get			= require('lodash/get')
const _isEqual 		= require('lodash/isEqual')
const _toInteger	= require('lodash/toInteger')
const _includes		= require('lodash/includes')
const _omit 		= require('lodash/omit')
const _has 		= require('lodash/has')

process.title = _includes(process.title, '/bin/node')? 'node_tick_room' : process.title

const store			= require('../../store')
const withDatabase 	= store.database.withDatabase

const dbRoomListByTick	= store.getLua('/room/collections/roomListByTick.lua')
const publishUpdateToRoom	= store.getLua('/room/publishUpdateToRoom.lua')

//console.log("new tick instance")

//TODO: look into pausing queue again when rooms are empty, then resuming when we have tick via session/room queue
module.exports = function(job){
	let lastDbConnection = _get(job, 'db')
	return withDatabase((db) => {
		if(!_has(db, 'roomListByTick')) db.defineCommand('roomListByTick', {numberOfKeys: 0, lua: dbRoomListByTick})
		if(!_has(db, 'publishUpdateToRoom')) db.defineCommand('publishUpdateToRoom', {numberOfKeys: 1, lua: publishUpdateToRoom})

		let nodeTime = Date.now()
		let getLastUpdate = () => db.getset('tick|updated', nodeTime).then((result) => _toInteger(result)>0 ? _toInteger(result) : nodeTime).catchReturn(nodeTime)
		let getRoomList	= (lastUpdate = nodeTime) => db.roomListByTick(0, lastUpdate).catchReturn([])
		let updateRoom = (room) => db.publishUpdateToRoom(room, nodeTime).catchReturn('INVALID')

		return getLastUpdate()
			.tap((result) => {_log('[get last update time]', result)})
			.then(getRoomList)
			.tap((result) => {_log('[get room list]', result)})
			.each(updateRoom)
			.tap((result) => {_log('[update rooms]', result)})
			.tapCatch(_error)
			.return('OK')

	}, lastDbConnection)
		.tap((result) => {
			_log(`[Memory Usage]: MB`, Math.round(process.memoryUsage().heapUsed / 1024 / 1024 * 100) / 100)
			_log('[ROOM tick] DONE', _omit(result, 'db'))
		})
		.return('OK')
		.tapCatch((err) => {
			_error('[Error room tick Check]', err.status, err.message)
			console.log(err, err.stack.split("\n"))
		})
}


