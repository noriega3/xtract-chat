"use strict"
let apm = require('elastic-apm-node')

const debug = require('debug')
debug.log = console.info.bind(console) //one all send all to console.
const _log = debug('sendSsoCheck')
const _error = debug('sendSsoCheck:err')

const store	        = require('../../store')
const withDatabase = store.database.withDatabase
const sendSsoCheck 	= store.getLua('./scripts/redis2/session/sendSsoCheck.lua')

const _get = require('lodash/get')

module.exports = function(job){
	const lastDbConnection	= _get(job, 'db')
	const userId 	= _get(job, 'data.params.userId')
	const appName 	= _get(job, 'data.params.appName')
	const sessionId = _get(job, 'data.sessionId')

	return withDatabase((client) => {
		client.defineCommand('sendSsoCheck', {numberOfKeys: 2, lua: sendSsoCheck})
		return client.sendSsoCheck(userId, sessionId, appName)
			.return('OK')
			.tapCatch(_error)
			.catchThrow(new Error('INVALID SSO CHECK'))
	},lastDbConnection)
}
