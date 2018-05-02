const debug         = require('debug')      //https://github.com/visionmedia/debugdebug.log = console.info.bind(console) //one all send all to console.
debug.log = console.info.bind(console) //one all send all to console.
const _log          = debug('queues')
const _error        = debug('queues:err')

const Promise     	= require('bluebird')
const concat       	= require('lodash/concat')
const remove       	= require('lodash/remove')
const includes     	= require('lodash/includes')
const find    		= require('lodash/find')
const result    	= require('lodash/result')
const filter    	= require('lodash/filter')
const isEqual    	= require('lodash/isEqual')
const _map    		= require('lodash/map')
const _has    		= require('lodash/has')
const _without 		= require('lodash/without')
let _queues 		= []

const reset = () => { _queues = [] }

const getQueues = (idSearch, withoutQueue) => {
	let result = _queues
	if(idSearch) result = filter(_queues, ({_identifier}) => includes(idSearch, _identifier))
	if(withoutQueue) result = _without(_queues, withoutQueue)
	return result
}

const addQueue = (Queue) => {
	let queueName 	= 	result(Queue, 'getName')
	console.log('[Queue] Adding', queueName)

	//ensure there is a socket
	if(!Queue) {
		_error('Invalid Queue found for client')
		return new Error('Invalid Queue')
	}
	//add to list
	return _queues.push(Queue) ? {
		...Queue,
		close: () => removeQueue(Queue)
	} : new Error('Invalid Queue')
}
const removeQueue = (Queue) => {
	if(!Queue) {
		_log('no Queue found')
		return new Error('Invalid Queue')
	}

	remove(_queues, Queue)
	_log('[Queue] size after remove', _queues.length)
	return _has(Queue, 'has') ? Queue.close() : true
}

const removeQueueByName = (idSearch = '') => {
	const _queueFound = find(_queues, ({_identifier}) => isEqual(idSearch, _identifier))
	if(_queueFound) return removeQueue(_queueFound)
	return false
}

const getQueueByName = (idSearch) => {
	const _queueFound = find(_queues, ({_identifier}) => isEqual(idSearch, _identifier))
	if(_queueFound) return _queueFound.getQueue()
	_log('queue list', _queues)
	throw new Error(`Queue not found for ${idSearch}`)
}

const destroyAllQueues = () =>
	Promise.mapSeries(_queues, (q) => {
		remove(_queues, q)
		if(_has(q, 'close')) return q.close()
		else return 'empty'
	})

module.exports = {
	reset,
	getQueues,
	addQueue,
	removeQueue,
	removeQueueByName,
	getQueueByName,
	destroyAllQueues
}
