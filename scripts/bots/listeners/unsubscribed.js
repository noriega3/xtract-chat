const debug         = require('debug')      //https://github.com/visionmedia/debug
const _log          = debug('bot:unSubscribed')
const _error        = debug('bot:unSubscribed:err')
debug.log = console.info.bind(console) //one all send all to console.

module.exports = function(data){
	const subscriptions = this.getSubscriptions()
	return _.remove(subscriptions, function(n) {return _.isEqual(n, data.room) })
}
