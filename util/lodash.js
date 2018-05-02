const path = require('path')
const cluster	= require('cluster')
const Promise 	= require('bluebird') //http://bluebirdjs.com/docs/api-reference.html
const _ 		= require('lodash')
const debug 	= require('debug') //https://github.com/visionmedia/debug
debug.log = console.info.bind(console) //one all send all to console.

//Constants
const _logHeader 	= `${process.env.SERVER_NAME}:${_.get(cluster, 'worker.id', '0')}`
let _error			= debug(`${_logHeader} [Error] `)
let _logserver 		= debug(`${_logHeader} [Server] `)

/**/

const arrToSet = (arr) => {
	if (!arr){ return null }

	let result = []
	let length = arr.length
	for (let i = 0; i < length; i+=2) {
		let item = arr[i]
		let next = arr[i+1]
		result.push([item, next])
	}
	return result
}

const remapToObject = (arr) =>
	arr.reduce((result, item) => {
		result[item[1]] = item[0]
		return result
	}, {})

/**
 * Additional lodash functions
 */
_.mixin({
	arrToSet, remapToObject,
	colon: (args) => _.join(args, ':'),
	objToArr: function (obj) {
		let result = [];
		for (let key in obj) {
			if (obj.hasOwnProperty(key)) {
				result.push(key, obj[key]);
			}
		}
		return result;
	},
	settleAll: (promises) => {
		return Promise.all(promises.map(promise => Promise.resolve(promise).reflect()))
			.then(function(results) {
				const err = results.find(e=>e.isRejected());
				if (err) {
					throw err.reason;
				} else {
					return results.map(e=>e.value);
				}
			});
	},
	retry: (task, maxRetries) => {
		return task().catch(e=>{
			if (!maxRetries) return this(task, maxRetries-1);
			throw e;
		});
	}

})
//accessible outside this module
module.exports = _
