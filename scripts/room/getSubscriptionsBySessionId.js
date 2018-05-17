"use strict"
const debug         = require('debug')      //https://github.com/visionmedia/debug
const _log          = debug('getSubsBySessionId')
const _error        = debug('getSubsBySessionId:err')

const _toInteger	= require('lodash/toInteger')
const _isArray	= require('lodash/isArray')
const _size	= require('lodash/size')
const _has	= require('lodash/has')

const Promise = require('bluebird')

module.exports = function({db, sessionId}){
	return new Promise((resolve,reject) => {
		const sessionRoomsKey = `sessions|${sessionId}|rooms`
		let stream = db.zscanStream(sessionRoomsKey)
		let multi = db.multi()
		let dbRoomList = []
		let roomKey, roomName

		const cleanup = () => {
			stream = null
			multi = null
			dbRoomList = null
			roomKey = null
			roomName = null
		}

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
				cleanup()
				return resolve([])
			} else {
				multi.exec()
					.tap((results) => {
						_log('3333', results)
					})
					.reduce((result, [, roomType], i) => result.push([_toInteger(roomType), dbRoomList[i]]) ? result : result, [])
					.tap((results) => {
						if(_has(multi,'discard')) multi.discard()
						if(_has(multi,'disconnect')) multi.disconnect()
						_log('results', results)
					})
					.then((result) => {
						cleanup()
						return resolve(result)
					})
					.catch(reject)
			}
		})
		stream.on('error', (err) => {
			_error(err)
			reject(err)
			cleanup()
		})
	})
}
