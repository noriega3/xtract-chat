"use strict"
const debug         = require('debug')      //https://github.com/visionmedia/debug
const _log          = debug('destroy')
const _error        = debug('destroy:err')

const Promise		= require('bluebird')

const {
	getSubscriptionsBySessionId
} = require('../room')

const store = require('../../store')
const withDatabase = store.database.withDatabase

const unsubscribe = require('./unsubscribe')

module.exports = (job) => {
	const data = job.data
	const sessionId = data.sessionId
	const destroyType = data.destroyType || 'normal'

	_log('[Request]: DESTROY:', sessionId, destroyType)

	//Retrieve any existing rooms the user may be subscribed to
	return withDatabase((client) => {
		return getSubscriptionsBySessionId([sessionId])
			.then((rooms) => unsubscribe({ data: {sessionId, rooms}}))
			.tap((result) => {_log('[Destroy] Unsub Result', result)})
			.then(() => client.destroySession(sessionId, destroyType))
			.tap((result) => {_log('[Destroy] Result', result)})
		})
		.return('OK')
		.catch((err) => {
			_error('[Error Destroy]', err)
			throw new Error('Error '+ err.toString())
		})
}
