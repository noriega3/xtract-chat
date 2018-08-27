"use strict"
const debug         = require('debug') //https://github.com/visionmedia/debug
debug.log = console.info.bind(console) //one all send all to console.
const _log          = debug('botQueue')
const _error        = debug('botQueue:err')

const store			= require('../store')
const queues		= store.queues
const Queue 		= require('../scripts/queue')

const _identifier 	= 'botsQueue'

const BotEventQueue = function(){
	const _queue = Queue(_identifier)

	_queue.process('*', 'scripts/jobs/bots.js')

	//Clean up the onPlayerSub/Unsubs when many people join at the same time.
	_queue.on('completed', function(job){
		_queue.clean(1000)
	})

	return queues.addQueue(_identifier,{
		getName(){ return _identifier },
		getQueue(){ return _queue }
	})
}

//singleton
exports = module.exports = BotEventQueue
