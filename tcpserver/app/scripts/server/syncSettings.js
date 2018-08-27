const debug         = require('debug')      //https://github.com/visionmedia/debug
debug.log = console.info.bind(console) //one all send all to console.
const _log          = debug('updateServerConfig')
const _error        = debug('updateServerConfig:err')

const Promise       = require('bluebird')

const _isEmpty			= require('lodash/isEmpty')
const _size				= require('lodash/size')
const _isEqual			= require('lodash/isEqual')
const _get				= require('lodash/get')

const fs				= Promise.promisifyAll(require('fs-extra'))
const store	        	= require('../../store')
const getSettingsClient	= store.database.getSettingsClient
let lastSync 			= -1
const configPath 		= process.env.NODE_PATH+'/config.json'
const configDefaultPath = process.env.NODE_PATH+'/config.default.json'

const loadConfigFromDb = () => {
	return getSettingsClient()
		.getConfigAsync()
		.then(JSON.parse)
		.then((obj) => !_isEmpty(obj) ? obj : false)
		.catchReturn(false)
}

const loadConfigFromFile = () => {
	return fs.pathExistsAsync(configPath).then((exists) => exists ? fs.readJsonAsync(configPath) : false)
}

const loadDefaultConfig = () => {
    return fs.pathExistsAsync(configDefaultPath).then((exists) => exists ? fs.readJsonAsync(configDefaultPath) : false)
}
const writeConfig = (loadedConfig) => {
    return fs.writeJsonAsync(configPath, loadedConfig).then((err) => {
    	if(err) return console.error(err)
		return loadedConfig
	})
}

const syncSettings = (loadedConfig) => {
	console.log('sync settings')
	return getSettingsClient()
		.setConfigAsync(JSON.stringify(loadedConfig))
		.then((savedConfig, syncTime) => {
			console.log('set new sync time', syncTime)
			lastSync = syncTime
			return fs.outputFileAsync(configPath, savedConfig)
		})
        .tapCatch((err) => {_error('[SYNC ERR]', err)})
		.return(loadedConfig)
}

const checkSyncSettings = (loadedConfig) => {
	const needToSync = _get(loadedConfig, 'synced', 0) > lastSync
	console.log(loadedConfig, lastSync)
	return (needToSync) ? syncSettings(loadedConfig) : loadedConfig
}

module.exports = () => {
    return Promise.props({
        dbConfig: loadConfigFromDb(),
        fsConfig: loadConfigFromFile()
    })
	.then((props) => {
		console.log('props', props)
		if(props.dbConfig) return writeConfig(props.dbConfig)
		if(!props.fsConfig) return loadDefaultConfig()
		return props.fsConfig
	})
	.then((config) => {
		if(!config) throw new Error('No server config')
		console.log('config using ', config)
		store.setConfig(config)
		return checkSyncSettings(config)
    })
	.catch(SyntaxError, function (e) {
		throw new SyntaxError('INVALID CONFIG.JSON')
	})
	.catch(function (e) {
		_error("unable to read file", e.toString())
		throw new Error('INVALID CONFIG')
	})
}
