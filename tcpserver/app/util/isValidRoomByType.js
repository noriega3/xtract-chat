const {
	TURNBASED_ROOM_TYPE,
	REALTIME_ROOM_TYPE,
	STANDARD_ROOM_TYPE,
	SYSTEM_ROOM_TYPE,
} = require('../scripts/constants')

const _isNumber = require('lodash/isNumber')

module.exports = function(roomType){
	if(!_isNumber(roomType)) throw new Error('NO ROOM TYPE')

	switch (roomType){
		case TURNBASED_ROOM_TYPE:
		case REALTIME_ROOM_TYPE:
		case STANDARD_ROOM_TYPE:
		case SYSTEM_ROOM_TYPE:
			return true
		default:
			return false
	}
}
