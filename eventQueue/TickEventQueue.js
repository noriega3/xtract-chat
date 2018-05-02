const debug         = require('debug') //https://github.com/visionmedia/debug
const _log 		= debug("tickerQ")
const _error 	= debug("tickerQError")

const _isEqual 		= require('lodash/isEqual') //https://lodash.com/docs/4.17.4
const _forEach		= require('lodash/forEach') //https://lodash.com/docs/4.17.4

const Promise       = require('bluebird')
const store			= require('../store')
const queues		= store.queues
const db        	= store.database
const getConnection 	= store.database.getConnection
const getQueues        	= store.queues.getQueues

const RoomActions 	= require('../scripts/room/shared')
const Queue 		= require('../scripts/queue')

const _identifier 	= 'tickerQueue'

const TickerEventQueue = () => {
	const _queue = Queue(_identifier)
	setupQueue(_queue)
	return queues.addQueue({
		_identifier,
		getName: () => _identifier,
		getQueue: () => _queue
	})
}

const setupQueue = (queue) => {
	queue.process('idle', 1,'scripts/jobs/tick.js')
	queue.process('clean', () => {
		const queueList = getQueues(false)
		_forEach(queueList, (q) => {
			q.childPool.clean()
			console.log(q)
		})
		return Promise.resolve('CLEANED')
	})

	queue.on('error', function(job, err){
		_log('tick error', err)
		_log('tick error', job)
	})

	queue.add('idle', {}, {repeat: { cron: '*/5 * * * * *'}, removeOnComplete: true})
	queue.add('clean',{}, {repeat: { cron: '*/15 * * * * *'}, removeOnComplete: true, removeOnFail: true})

}

//singleton
exports = module.exports = TickerEventQueue
