"use strict"
let apm = require('elastic-apm-node')

const debug         = require('debug')      //https://github.com/visionmedia/debug
const _log          = debug('destroy')
const _error        = debug('destroy:err')

const Promise		= require('bluebird')

const _get			= require('lodash/get')
const _isEqual		= require('lodash/isEqual')
const _includes		= require('lodash/includes')
const _omit			= require('lodash/omit')

process.title = _includes(process.title, '/bin/node')? 'node_destroy' : process.title

const store = require('../../store')
const withDatabase = store.database.withDatabase

const unsubscribe = Promise.method(require('./unsubscribe'))
const getSubscriptionsBySessionId = Promise.method(require('../room/getSubscriptionsBySessionId'))

const destroySession = store.getLua('./scripts/redis2/session/destroySession.lua')


module.exports = function(job){
	const lastDbConnection = _get(job, 'db')
	return withDatabase((db) => {
		const sessionId 		= _get(job, 'data.sessionId')
		const unsubType			= _get(job, 'data.unsubType', 'destroy')

		_log('[Request]: DESTROY:', sessionId, unsubType)

		db.defineCommand('destroySession', {numberOfKeys: 1, lua:destroySession})

		return getSubscriptionsBySessionId({db, sessionId})
			.then((rooms) => unsubscribe({db, data: {sessionId, rooms, unsubType: 'destroy'}}))
			.tap((result) => {_log('[DESTROY] Unsub Result', result)})

			.then(() => db.destroySession(sessionId, unsubType))
			.tap((result) => {_log('[DESTROY] DONE', result)})

			.tapCatch(_error)
			.return('OK')

	}, lastDbConnection)
		.tap((result) => {_log('[DESTROY] DONE', _omit(result, 'db'))})
		.return('OK')
		.tapCatch((err) => {
			_error('[Error Destroy]', err.status, err.message)
			console.log(err, err.stack.split("\n"))
		})
}
