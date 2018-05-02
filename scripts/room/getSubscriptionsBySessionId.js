"use strict"
const debug         = require('debug')      //https://github.com/visionmedia/debug
const _log          = debug('getSubsBySessionId')
const _error        = debug('getSubsBySessionId:err')

const _toInteger	= require('lodash/toInteger')
const _isArray	= require('lodash/isArray')
const _size	= require('lodash/size')
const _concat	= require('lodash/concat')

const Promise = require('bluebird')
const store = require('../../store')
const withDatabase = store.database.withDatabase

module.exports = ([sessionId]) => {
	return withDatabase((client) => {
		return Promise.method(function(){
			let dbRoomList = []
			let dbRooms = []
			let roomKey, roomName
			const sessionRoomsKey = `sessions|${sessionId}|rooms`
			const stream = client.zscanStream(sessionRoomsKey)
			const multi = client.multi()

			stream.on('data', (result) => {
				if (_isArray(result)) {
					for (let i = 0; i < _size(result); i += 2) {
						roomName = result[i]
						roomKey = `rooms|${roomName}|info`
						dbRoomList.push(roomName)
						multi.hget(roomKey, 'roomTypeId')
					}
				}
			})

			stream.on('end', () => {
				if(_size(dbRoomList) <= 0){
					multi.discard()
					return Promise.resolve([])
				}
				multi.exec()
					.tap((results) => {
						_log('3333', results)
					})
					.reduce((result, [, roomType], i) => result.push([_toInteger(roomType), dbRoomList[i]]) ? result : result, [])
					.tap((results) => {
						_log('results', results)
					})
					.then(Promise.resolve)
					.catch(Promise.reject)
			})

			stream.on('error', Promise.reject)
		})()
	})
/*
	.timeout(5000)
	.catch(Promise.TimeoutError, () => {
		_error('timeout on getting subs ')
	})
 */
}
