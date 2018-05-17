"use strict"
const debug         = require('debug') //https://github.com/visionmedia/debug
debug.log = console.info.bind(console) //one all send all to console.
const _log 		= debug("tickerQ")
const _error 	= debug("tickerQError")

const _forEach		= require('lodash/forEach') //https://lodash.com/docs/4.17.4

const Promise       = require('bluebird')
const store			= require('../store')
const queues		= store.queues
const getQueues     = store.queues.getQueues
const Queue 		= require('../scripts/queue')

const _identifier 	= 'tickerQueue'

const TickEventQueue = function(){
	const _queue = Queue(_identifier)

	_queue.process('idle',1,'scripts/jobs/tick.js')
	//_queue.process('roomUpdates',1,'scripts/jobs/tickRoomUpdates.js')

	_queue.on('completed', function(job){
		_log('complete')
		_log('job is complete', job.id)
	})

	queues.addQueue(_identifier, {
		getName: () => _identifier,
		getQueue: () => _queue
	})

	return _queue
}

//singleton
exports = module.exports = TickEventQueue
