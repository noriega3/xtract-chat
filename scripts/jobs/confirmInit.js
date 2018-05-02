"use strict"
const debug         = require('debug')      //https://github.com/visionmedia/debug
debug.log = console.info.bind(console) //one all send all to console.
const _log          = debug('confirmInit')
const _error        = debug('confirmInit:err')

const Promise = require('bluebird')
const _get = require('lodash/get')

const store = require('../../store')
const withDatabase = store.database.withDatabase

module.exports = function(job){
	const data = job.data
	const sessionId = data.sessionId
	const initEventId = _get(data, 'params.initEventId')
	const sessionRoom = `sessions:${sessionId}`

	console.log('data', data)

	let message = {
		phase: "confirmInit",
		room: sessionRoom,
		response: {}
	}

	return withDatabase((connection) => {
		return connection.confirmInit(sessionId, initEventId)
			.tap((result) =>  _log('[INIT CONFIRM] confirmation ', result.toString()))
			.then((result) => {
				message.response.initEventId = result.toString()
				return connection.publishToSession(sessionId, Date.now(), JSON.stringify(message))
			})
			.catch((err) => {
				_error('[Error Confirm Init]', err)
				throw new Error('Error '+ err.toString())
			})
	})

}
