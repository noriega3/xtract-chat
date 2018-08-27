const config = require('../config')
const Redis = require('ioredis')
let redis = new Redis(config.dbConnectionString)

module.exports = redis