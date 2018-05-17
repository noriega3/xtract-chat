//simulated client (taken functions from dashboard)
process.env.NODE_PATH = '.'
process.env.DEBUG_COLORS = true
process.env.DEBUG_HIDE_DATE = true
process.env.NODE_ENV = 'development'
process.env.DEBUG = '*,-not_this,-ioredis:*,-bull'

const chai = require("chai");

chai.config.includeStack = true; // turn on stack trace
chai.config.showDiff = true; // turn off reporter diff display
chai.config.truncateThreshold = 10; // disable truncating

exports.chai = chai;
exports.assert = chai.assert;
exports.expect = chai.expect;
exports.Subscriber = require('../scripts/bots/bot')

chai.should()
