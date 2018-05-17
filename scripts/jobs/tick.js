"use strict"
let apm = require('elastic-apm-node')

const debug         = require('debug') //https://github.com/visionmedia/debug
debug.log = console.info.bind(console) //one all send all to console.
const _log 			= debug('tickjob')
const _error 		= debug('tickjob:err')

const Promise		= require('bluebird')

const _get			= require('lodash/get')
const _isEqual 		= require('lodash/isEqual')
const _includes		= require('lodash/includes')
const _omit 		= require('lodash/omit')
const _has 			= require('lodash/has')

process.title = _includes(process.title, '/bin/node')? 'node_tick' : process.title

const store			= require('../../store')
const withDatabase 	= store.database.withDatabase

const dbIdleRooms 	= store.getLua('./scripts/redis2/room/collections/idleRooms.lua')
const dbDestroyRoom = store.getLua('./scripts/redis2/room/destroyRoom.lua')

console.log("new tick instance")

const roomNameToArr = require('../../util/roomNameToArr')
//TODO: look into pausing queue again when rooms are empty, then resuming when we have tick via session/room queue
module.exports = function(job){
	let lastDbConnection = _get(job, 'db')
	return withDatabase((db) => {
		const hasRooms = () => { return db.exists('tick|rooms', (err, result) => _isEqual(1, result))}

		const destroyRoom = (db, roomName, appendResponse = {}) => {
			if(!_has(db, 'destroyRoom')) db.defineCommand('destroyRoom', {numberOfKeys: 2, lua: dbDestroyRoom})

			return db.destroyRoom(roomName, Date.now(), JSON.stringify({
				...roomNameToArr(roomName)
			}), JSON.stringify(appendResponse))
		}

		const removeIdleRooms = (db) => {
			if(!_has(db, 'idleRooms')) db.defineCommand('idleRooms', {numberOfKeys: 0, lua: dbIdleRooms})
			return db.idleRooms(Date.now(), 10000)
				.each((foundName) => {
					//can either use a job or do it all at once
					return db.checkIdleRoom(foundName, Date.now()).then((status) => {
						if (_isEqual('IDLE', status))
							return destroyRoom(db, foundName)
						else
							return status
					})
				})
		}

		return Promise.props({hasRooms: hasRooms(db)})
			.then((props) => {
				if(!props.hasRooms) return 'OK'
				return Promise.all([removeIdleRooms(db)])

			})
			.tapCatch(_error)
			.return('OK')

	}, lastDbConnection)
		.tap((result) => {
			const used = Math.round(process.memoryUsage().heapUsed / 1024 / 1024 * 100) / 100;
			_log(`[Memory Usage]: ${used} MB`)
			_log('[TICK] DONE', _omit(result, 'db'))
		})
		.return('OK')
		.tapCatch((err) => {
			_error('[Error tick]', err.status, err.message)
			console.log(err, err.stack.split("\n"))
		})
}


