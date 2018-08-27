const {
	SYSTEM_ROOM_TYPE,
	TURNBASED_ROOM_TYPE,
	REALTIME_ROOM_TYPE,
	STANDARD_ROOM_TYPE
} = require('../scripts/constants')

const _get = require('lodash/get')
const _has = require('lodash/has')
const _isUndefined = require('lodash/isUndefined')

module.exports = function(params = {}, valueOnEmpty){
	//validation
	if((_has(params, 'isSystem') && _has(params, 'isGameRoom') && (params.isSystem && params.isGameRoom)) || (!_has(params, 'isGameRoom')  && _has(params, 'isTurnBased'))) throw new Error('INVALID PARAMS')

	if(_get(params, 'isSystem', false))
		return SYSTEM_ROOM_TYPE

	if(_get(params, 'isGameRoom') && _get(params, 'isTurnBased', false))
		return TURNBASED_ROOM_TYPE

	if(_get(params, 'isGameRoom', false))
		return REALTIME_ROOM_TYPE

	return !_isUndefined(valueOnEmpty) ? valueOnEmpty : STANDARD_ROOM_TYPE //default
}
