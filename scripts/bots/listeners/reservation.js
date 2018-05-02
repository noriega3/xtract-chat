const debug         = require('debug')      //https://github.com/visionmedia/debug
const _log          = debug('bot:reservation')
const _error        = debug('bot:reservation:err')
debug.log = console.info.bind(console) //one all send all to console.

const filteredArray = (arr) => arr.filter(function(item, pos){
	return arr.indexOf(item)=== pos
})

module.exports = function(data){
	const reservations = this.getReserves()
	if (data) {
		reservations.push(data.roomName)
		filteredArray(reservations)
	} else {
		_error('[Bot] err on reservation sub', data)
	}
}
