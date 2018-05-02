const _join = require('lodash/join')
module.exports = function() { return _join([...arguments], ':') }
