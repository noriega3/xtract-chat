const _					= require('lodash')
const {log, errlog}					= require('../../util/loggers')
const dbConfig			= require('../../_confs/config.default.json')
const store	        	= require('../../store')
const db				= store.database
const Promise			= require('bluebird')

module.exports = () => {
	//TODO: update text file via queue
	let serverConfig = {}
	let setting
	const settingsClient	= db.getSettingsClient()
	const settingMulti = settingsClient.multi()

	_.forEach(dbConfig, (value, key) => {
		setting =  dbConfig[key]
		if(_.isFunction(settingMulti[setting.getType])){
			_.invoke(settingMulti, setting.getType, setting.key)
		}
	})

	return settingMulti.exec()
	.then((configs) => {
		if(_.isEmpty(configs) || configs[0][0] || configs[0][1] === null){

			log('creating default config', dbConfig)
			const settingMulti2 = settingsClient.multi()

			_.forEach(dbConfig, (value, key) => {
				setting =  dbConfig[key]
				if(_.isFunction(settingMulti2[setting.setType])){
					_.invoke(settingMulti, setting.setType, setting.key, setting.defaultValue)
				}
			})

			return settingMulti.exec()
				.then(results => {

					if(_.isEmpty(results) || results[0][0]){
						throw new Error('Invalid Server Config')
					}

					const settingMulti3 = settingsClient.multi()

					_.forEach(dbConfig, (value, key) => {
						setting =  dbConfig[key]
						if(_.isFunction(settingMulti3[setting.getType])){
							_.invoke(settingMulti3, setting.getType, setting.key)
						}
					})
					return settingMulti3.exec()
				})
		}

		return configs
	})
	.then((configs) => {
		if(_.isEmpty(configs) || configs[0][0] || configs[0][1] === null){
			throw new Error('Invalid Server Config')
		}
		serverConfig = {}
		_.forEach(configs, ([err, value], key) => {
			const configName = dbConfig[key].config
			serverConfig[configName] = value
		})

		if(_.isEmpty(serverConfig)) throw new Error('SETTINGS ARE NOT FILLED IN, EITHER IT IS EMPTY OR IT GOT ERASED VIA REDIS MEMORY MANAGEMENT')

		store.setConfig(serverConfig)

		return serverConfig
	})
	.catch((err) => {
		console.log('error', err)
		errlog('[Error] ServerConfig', err)

		throw new Error(err)
	})
}

