const path = require('path')
const cluster	= require('cluster')
const _get 		= require('lodash/get')
const debug 	= require('debug') //https://github.com/visionmedia/debug
debug.log = console.info.bind(console) //one all send all to console.

//Constants
const _logHeader 	= `${process.env.SERVER_NAME}:${_get(cluster, 'worker.id', '0')}`
let _log			= debug(`${_logHeader} [Log] `)
let _error			= debug(`${_logHeader} [Error] `)
let _logserver 		= debug(`${_logHeader} [Server] `)

/** todo: optimize **/
Object.defineProperty(global, '__stack', {
	get: function() {
		const orig = Error.prepareStackTrace;
		Error.prepareStackTrace = function(_, stack) {
			return stack;
		};
		const err = new Error;
		Error.captureStackTrace(err, arguments.callee);
		const stack = err.stack;
		Error.prepareStackTrace = orig;
		return stack;
	}
});

Object.defineProperty(global, '__line', {
	get: function() {
		return __stack[2].getLineNumber();
	}
});

Object.defineProperty(global, '__function', {
	get: function() {
		return __stack[2].getFunctionName();
	}
});

Object.defineProperty(global, '__pfilename', {
	get: function() {
		return path.relative('.',__stack[2].getFileName());
	}
});

//accessible outside this module
module.exports = {
	log: _log,/*(...args) => debug(`${_logHeader}:(${__pfilename}:${__line}):`)(args),*/
	slog: _logserver,
	errlog: _error,
}
