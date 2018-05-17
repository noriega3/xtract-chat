"use strict"
const debug         = require('debug') //https://github.com/visionmedia/debug
debug.log = console.info.bind(console)
const _log 		= debug('requestEventQueue')
const _error 	= debug('requestEventQueue:err')
const Promise 	= require('bluebird')
const _isEqual	= require('lodash/isEqual')
const _has	= require('lodash/has')
const store	        = require('../store')
const queues		= store.queues
const Queue 		= require('../scripts/queue')
const addConfig = {
	attempts: 3,
	timeout: 5000,
	removeOnComplete: true,
}
//Routes from tcp client
const RequestEventQueue = function(){
	const _identifier 	= 'requestQueue'
	const _queue = Queue(_identifier)

	const performBotTask = Promise.method(function(result){
		if(!_has(result, 'intendedRoom') || !_has(result, 'formatType')) return Promise.resolve(result)
		const {formatType} = result

		if(!_isEqual(formatType, 'subscribe') && !_isEqual(formatType, 'unsubscribe')) return Promise.resolve(result)

		return queues.getQueueByName('botsQueue')
			.add(formatType, result, addConfig)
			.call('finished')
	})

	_queue.process('*', function(job){
		const {data: {queue = false , intent = '*', jobData = {}}} = job
		if(_isEqual(false, intent)) return Promise.reject('NO INTENT')
		return queues.getQueueByName(queue)
			.add(intent, jobData, addConfig)
			.then((job) => job.finished())
			.tapCatch((err) => {
				_error(job.data, err)
			})
			.catchReturn('ERROR')
	})

	_queue.on('error', function(error){
		_error('err @ requestEventQueue')
		_error(error)
	})

	_queue.on('completed', function(job){
		job.remove()
		_queue.clean(1000)
	})

	return queues.addQueue(_identifier,{
		getName(){ return _identifier },
		getQueue(){ return _queue }
	})
}

//singleton
exports = module.exports = RequestEventQueue
