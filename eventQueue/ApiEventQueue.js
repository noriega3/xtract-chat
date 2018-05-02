//Global handler for all api (express) commands from http server
"use strict"
const cluster       = require('cluster')
const debug         = require('debug') //https://github.com/visionmedia/debug
const store			= require('../store')
const _log 			= debug("apiEventQueue"+ (cluster.isWorker ? ":"+cluster.worker.id : ""))
const _error 		= debug("apiEventQueue:err")
const Queue 		= require('../scripts/queue')
const _identifier 	= 'apiQueue'

const ApiEventQueue = () => {
	const _queue = Queue(_identifier)
	setupQueue(_queue)
	return store.queues.addQueue({
		_identifier,
		getName: () => _identifier,
		getQueue: () => _queue
	})
}

const setupQueue = (queue) => {

	//roomSubQueue.setMaxListeners(0)
	queue.process('reserve', 1, 'scripts/jobs/reserve.js')
	queue.process('invite', 1, 'scripts/jobs/invite.js')

	//Clean up the onPlayerSub/Unsubs when many people join at the same time.
	queue.on('stalled', function(job){
		const jobId = job.jobId

		_error("job is stalled", job)
	})

	//Clean up the onPlayerSub/Unsubs when many people join at the same time.
	queue.on('error', function(job){
		const jobId = job.jobId

		console.log('err @ roomQueue')

		console.log(job)
	})

	queue.on('global:completed', function(jobId, result) {
		console.log(`Job ${jobId} completed! Result: ${result}`);
		queue.getJob(jobId).then(function(job) {
			job.remove();
		});
	});
}

//singleton
exports = module.exports = ApiEventQueue
