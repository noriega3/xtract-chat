const debug         = require('debug')      //https://github.com/visionmedia/debug
debug.log = console.info.bind(console) //one all send all to console.
const _log          = debug('updateServerConfig')
const _error        = debug('updateServerConfig:err')

const Promise       = require('bluebird')

const _isEmpty			= require('lodash/isEmpty')
const _isEqual			= require('lodash/isEqual')
const _get				= require('lodash/get')

const fs				= Promise.promisifyAll(require('fs'))
const store	        	= require('../../store')
const getSettingsClient	= store.database.getSettingsClient
let lastSync 			= -1

const loadConfigFromDb = () => {
	return getSettingsClient()
		.getConfigAsync()
		.then(JSON.parse)
		.then(Promise.resolve)
		.catchReturn({})
}

const loadConfigFromFile = (configFile) => {
	return fs.readFileAsync(configFile, 'utf8')
		.then(JSON.parse)
		.then(Promise.resolve)
		.catch(() => {
			if (!_isEqual('./config.default.json', configFile))
				return loadConfigFromFile('./config.default.json')
			else
				throw new Error('INVALID DEFAULT CONFIG')
		})
}

const syncSettings = (loadedConfig) => {
	return getSettingsClient()
		.setConfigAsync(JSON.stringify(loadedConfig))
		.then((savedConfig, syncTime) => {
			lastSync = syncTime
			return fs.writeFileAsync('./config.json', savedConfig, 'utf8')
		})
		.return(loadedConfig)
}

const checkLoadConfigFile = (loadedConfig) => {
	return (_isEmpty(loadedConfig)) ? loadConfigFromFile('./config.json') : Promise.resolve(loadedConfig)
}

const checkSyncSettings = (loadedConfig) => {
	const needToSync = _get(loadedConfig, 'synced', 0) > lastSync
	return (needToSync) ? syncSettings(loadedConfig) : Promise.resolve(loadedConfig)
}

module.exports = () => {
	return loadConfigFromDb()
		.then(checkLoadConfigFile)
		.then(checkSyncSettings)
		.tapCatch((error) => {_error(error)})
		.catch(SyntaxError, function (e) {
			_error("invalid json in file")
			throw new SyntaxError('INVALID CONFIG.JSON')
		})
		.catch(function (e) {
			_error("unable to read file")
			throw new Error('INVALID CONFIG')
		})
}
