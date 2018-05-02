const {
	SYSTEM_ROOM_TYPE,
	TURNBASED_ROOM_TYPE,
	REALTIME_ROOM_TYPE,
	STANDARD_ROOM_TYPE
} = require('../scripts/constants')

const _isUndefined = require('lodash/isUndefined')

module.exports = function(roomType, valueOnEmpty){

	switch(roomType){
		case SYSTEM_ROOM_TYPE:
			return {isSystem:true}
		case TURNBASED_ROOM_TYPE:
			return {isGameRoom:true, isTurnBased:true}
		case REALTIME_ROOM_TYPE:
			return {isGameRoom:true}
		case STANDARD_ROOM_TYPE:
			return {}
		default:
			return !_isUndefined(valueOnEmpty) ? valueOnEmpty : {} //default
	}
}
