const {
	SYSTEM_ROOM_TYPE,
	TURNBASED_ROOM_TYPE,
	REALTIME_ROOM_TYPE,
	STANDARD_ROOM_TYPE
} = require('../scripts/constants')

const _has = require('lodash/has')
const _isUndefined = require('lodash/isUndefined')

module.exports = function(params = {}, valueOnEmpty){
	//validation
	if(_has(params, 'isSystem') && (_has(params, 'isGameRoom') || _has(params, 'isTurnBased'))) throw new Error('INVALID PARAMS')

	if(_has(params, 'isSystem'))
		return SYSTEM_ROOM_TYPE

	if(_has(params, 'isGameRoom') && _has(params, 'isTurnBased'))
		return TURNBASED_ROOM_TYPE

	if(_has(params, 'isGameRoom'))
		return REALTIME_ROOM_TYPE

	return !_isUndefined(valueOnEmpty) ? valueOnEmpty : STANDARD_ROOM_TYPE //default
}
