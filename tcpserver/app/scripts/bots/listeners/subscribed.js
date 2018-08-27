const debug         = require('debug')      //https://github.com/visionmedia/debug
const _log          = debug('bot:subscribed')
const _error        = debug('bot:subscribed:err')
debug.log = console.info.bind(console) //one all send all to console.

const filteredArray = (arr) => arr.filter(function(item, pos){
	return arr.indexOf(item)=== pos
})

module.exports = function(data){
	const subscriptions = this.getSubscriptions()
	subscriptions.push(data.room)
	filteredArray(subscriptions) //remove duplicates
	return true
}
