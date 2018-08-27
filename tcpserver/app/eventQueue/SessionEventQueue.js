"use strict"
const debug         = require('debug') //https://github.com/visionmedia/debug
debug.log = console.info.bind(console)
const _log 		= debug("sessionQ")
const _error 	= debug("sessionQ:err")

const store	        = require('../store')
const queues		= store.queues
const Queue 		= require('../scripts/queue')
const NODE_PATH		= process.env.NODE_PATH || '.'
//jobs
const _identifier 	= 'sessionQueue'

const SessionEventQueue = function(){
	const _queue = Queue(_identifier)

	_queue.process('*', NODE_PATH+'/scripts/jobs/sessions.js')

	_queue.on('completed', function(job){
		console.log('job finished', job.id)
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
