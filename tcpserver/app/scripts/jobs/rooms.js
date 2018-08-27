"use strict"


const debug = require('debug')
debug.log = console.info.bind(console) //one all send all to console.
const _log = debug('roomsProcess')
const _error = debug('roomsProcess:error')

const _includes	= require('lodash/includes')
const _get 		= require('lodash/get')

process.title = _includes(process.title, '/bin/node') ? 'node_rooms_process' : process.title

module.exports = function(job){
	const name = _get(job, 'name')
	switch(name){
		case 'subscribe':
		case 'unsubscribe':
		case 'checkTick':
			return require(`./room.${name}`)(job)
		default:
			_error(`Could not find matching ${name}`)
			throw new Error('INVALID INTENT')
	}
}
