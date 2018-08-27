"use strict"
const debug         = require('debug') //https://github.com/visionmedia/debug
debug.log = console.info.bind(console)
const _log 			= debug("apiEventQueue")
const _error 		= debug("apiEventQueue:err")

const store			= require('../store')
const Queue 		= require('../scripts/queue')

const _identifier 	= 'apiQueue'

const ApiEventQueue = function(){
	const _queue = Queue(_identifier)

	//roomSubQueue.setMaxListeners(0)
	_queue.process('*','scripts/jobs/api.js')

	_queue.on('completed', function(job){
		_queue.clean(1000)
	})
	//Clean up the onPlayerSub/Unsubs when many people join at the same time.
	_queue.on('stalled', function(job){
		const jobId = job.jobId

		_error("job is stalled", job)
	})

	//Clean up the onPlayerSub/Unsubs when many people join at the same time.
	_queue.on('error', function(job){
		const jobId = job.jobId

		console.log('err @ roomQueue')

		console.log(job)
	})

	return store.queues.addQueue(_identifier, {
		_identifier,
		getName: () => _identifier,
		getQueue: () => _queue
	})
}

//singleton
exports = module.exports = ApiEventQueue
