"use strict"
let apm = require('elastic-apm-node')

const debug = require('debug')
debug.log = console.info.bind(console) //one all send all to console.
const _log = debug('verifySso')
const _error = debug('verifySso:error')

const Promise		= require('bluebird')

const _isEqual = require('lodash/isEqual')
const _includes		= require('lodash/includes')
const _get			= require('lodash/get')
const _omit			= require('lodash/omit')

process.title = _includes(process.title, '/bin/node')? 'node_ssoCheck' : process.title

const store	        = require('../../store')
const withDatabase = store.database.withDatabase


module.exports = function(job){
	const lastDbConnection	= _get(job, 'db')
	return withDatabase((db) => {
		const sessionId		= _get(job, 'data.sessionId')
		const rawMessage	= _get(job, 'data.rawMessage')

		return db.verifySsoCheck(sessionId, rawMessage)
			.then((result) => {
				return 'OK'
			})
			.catch((err) => {

				_log('WOULD LOG OUT HERE')
				/*			return sessionQueue.add('destroy', {sessionId: sessionId, destroyType: 'expired'}, addConfig)
                                .then((nestedJob) => nestedJob.finished())
                                .then((nestedJobResult) => sessionId)
                                .catch((err) => 'OK')*/

				_error('[Error verifySsoCheck]', err)
				throw new Error('Error '+ err.toString())
			})
	}, lastDbConnection)
		.tap((result) => {_log('[SSO CHECK] DONE', _omit(result, 'db'))})
		.return('OK')
		.tapCatch((err) => {
			_error('[Error Sso Check]', err.status, err.message)
			console.log(err, err.stack.split("\n"))
		})
}
