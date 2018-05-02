const debug         = require('debug') //https://github.com/visionmedia/debug
debug.log = console.info.bind(console)
const _log 		= debug("sessionQ")
const _error 	= debug("sessionQ:err")

const _ 			= require('lodash')
const helper       	= require('../util/helpers')
const store	        = require('../store')
const getConnection	= store.database.getConnection
const db			= store.database
const queues		= store.queues


const addConfig = {
    attempts: 1,
    removeOnComplete: false,
	//timeout: 10000,
	backoff: {
		type: 'fixed',
		delay: 500
	}
}
const RoomActions 	= require('../scripts/room/shared')
const Queue 		= require('../scripts/queue')

//jobs
const jobInit 			= require('../scripts/jobs/init.js')
const jobSendSsoCheck 	= require('../scripts/jobs/sendSsoCheck.js')

const _identifier 	= 'sessionQueue'
_log('queue list', queues.getQueues())

const SessionEventQueue = () => {
	const _queue = Queue(_identifier)
	setupQueue(_queue)
	return queues.addQueue({
		_identifier,
		getName: () => _identifier,
		getQueue: () => _queue
	})
}

const setupQueue = (queue) => {

	queue.process('initSession', 'scripts/jobs/init.js')
	queue.process('confirmInit', 'scripts/jobs/confirmInit.js')
	queue.process('destroy', 'scripts/jobs/destroy.js')
	queue.process('keepAlive','scripts/jobs/keepAlive.js')
	queue.process('sendSsoCheck','scripts/jobs/sendSsoCheck.js')
	queue.process('verifySsoCheck', 'scripts/jobs/verifySsoCheck.js')
	queue.process('expireCheck', 'scripts/jobs/expireCheck.js')
	queue.on('completed', function(job, result){
		//queue.childPool.clean()
		console.log('cleaned')
	})
	queue.on('global:completed', function(jobId, result) {
		console.log(`Job ${jobId} completed! Result: ${result}`);
		queue.getJob(jobId).then(function(job) {
			job.remove();
		});
	});
}

//singleton
exports = module.exports = SessionEventQueue
