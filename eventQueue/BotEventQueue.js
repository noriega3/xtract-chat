"use strict"
const debug         = require('debug') //https://github.com/visionmedia/debug
const _log          = debug('botEventQueue')
const _error        = debug('botEventErr')
const store			= require('../store')
const queues		= store.queues
const RoomActions 	= require('../scripts/room/shared')
const Queue 		= require('../scripts/queue')
const _identifier 	= 'botsQueue'

const BotEventQueue = () => {
	const _queue = Queue(_identifier)
	setupQueue(_queue)
	return queues.addQueue({
		_identifier,
		getName: () => _identifier,
		getQueue: () => _queue
	})
}

const setupQueue = (queue) => {

	queue.process('*', 10,'scripts/jobs/bots.js')

	queue.on('stalled', function(job) {
		console.log('job stalled')
	})

	queue.on('error', function(job, err){
		_log('tick error', err)
		_log('tick error', job)
	})

	queue.on('global:completed', function(jobId, result) {
		/*	console.log(`Job ${jobId} completed! Result: ${result}`);
            queue.getJob(jobId).then(function(job) {
                job.remove();
            });*/
	});

	return {}
}

//singleton
exports = module.exports = BotEventQueue
