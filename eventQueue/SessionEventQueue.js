"use strict"
const debug         = require('debug') //https://github.com/visionmedia/debug
debug.log = console.info.bind(console)
const _log 		= debug("sessionQ")
const _error 	= debug("sessionQ:err")

const store	        = require('../store')
const queues		= store.queues
const Queue 		= require('../scripts/queue')

//jobs
const _identifier 	= 'sessionQueue'

const SessionEventQueue = function(){
	const _queue = Queue(_identifier)

	_queue.process('initSession', 'scripts/jobs/init.js')
	_queue.process('confirmInit', 'scripts/jobs/confirmInit.js')
	_queue.process('destroy', 'scripts/jobs/destroy.js')
	_queue.process('keepAlive','scripts/jobs/keepAlive.js')
	_queue.process('sendSsoCheck','scripts/jobs/sendSsoCheck.js')
	_queue.process('verifySsoCheck', 'scripts/jobs/verifySsoCheck.js')
	_queue.process('expireCheck', 'scripts/jobs/expireCheck.js')

	_queue.on('completed', function(job){
	})

	_queue.on('error', function(error){
		_error('err @ sessionQueue')
		_error(error)
	})

	return queues.addQueue(_identifier,{
		getName(){ return _identifier },
		getQueue(){ return _queue }
	})
}

//singleton
exports = module.exports = SessionEventQueue
