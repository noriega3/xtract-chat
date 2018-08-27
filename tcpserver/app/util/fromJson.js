const _attempt = require('lodash/attempt')
module.exports = function(str){
	return _attempt(JSON.parse.bind(null, str))
}
