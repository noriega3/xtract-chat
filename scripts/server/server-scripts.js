'use strict'
const debug     = require('debug')      //https://github.com/visionmedia/debug
const _ 		= require('lodash')
const fs 		= require('fs')
const globals   = require('../../globals')
const _log      = debug('server-script')
const dbConfig	= require('../../_confs/config.default.json')
let client, subClient, settingsClient

const scripts = function(dbClient, dbSubscriber, dbSettings){
	//set the client and settings client from the init.
	client 			= dbClient
	subClient 		= dbSubscriber
	settingsClient 	= dbSettings



	client.defineCommand('hexAdd', {
		numberOfKeys: 1,
		lua: fs.readFileSync("./scripts/redis/hexAdd.lua", "utf8")
	})

	client.defineCommand('hexRem', {
		numberOfKeys: 1,
		lua: fs.readFileSync("./scripts/redis/hexRem.lua", "utf8")
	})

	client.defineCommand('hexSearch', {
		numberOfKeys: 4,
		lua: fs.readFileSync("./scripts/redis/hexSearch.lua", "utf8")
	})

	/***
	 * @example client.hexExists('rediskey', spo, subject, predicate, object)
	 * @example client.hexExists('rediskey', pos, predicate, object, subject)
	 * @return true or false/nil
	 */
	client.defineCommand('hexExists', {
		numberOfKeys: 6,
		lua: fs.readFileSync("./scripts/redis/hexExists.lua", "utf8")
	})

	client.defineCommand('updateSessionData', {
		numberOfKeys: 1,
		lua: fs.readFileSync("./scripts/redis/session/updateSessionData.lua", "utf8")
	})

	client.defineCommand('prepareRoomEvent', {
		numberOfKeys: 5,
		lua: fs.readFileSync("./scripts/redis/rooms/prepareRoomEvent.lua", "utf8")
	})

	//Clear db 0 from last session
	dbClient.multi()
		.flushdb()
		.script('flush')
		.set('serverTime', Date.now())
		.exec()
		.tapCatch((err) => _error('err @ serverTime', err))

	//set current servertime to now
	globals.setVariable("SERVER_TIME", Date.now())
}

scripts.updateServerConfig = () => {

	const settingMulti = settingsClient.multi()
	let serverConfig = {}
	let setting

	_.forEach(dbConfig, (value, key) => {
		setting =  dbConfig[key]
		if(_.isFunction(settingMulti[setting.getType])){
			_.invoke(settingMulti, setting.getType, setting.key)
		}
	})

	return settingMulti.exec()
		.then((configs) => {
			console.log('empty result check')
			console.log(configs)
			if(_.isEmpty(configs) || configs[0][0] || configs[0][1] === null){

				_log('creating default config', dbConfig)
				const settingMulti2 = settingsClient.multi()

				_.forEach(dbConfig, (value, key) => {
					setting =  dbConfig[key]
					if(_.isFunction(settingMulti2[setting.setType])){
						_log('invoking')
						_log(setting)
						_.invoke(settingMulti, setting.setType, setting.key, setting.defaultValue)
					}
				})

				return settingMulti.exec()
					.then(results => {
					console.log('resultsss')
						console.log(results)

						if(_.isEmpty(results) || results[0][0]){
							console.log(results)
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

			//update global var
			globals.setVariable("SERVER_CONFIG", serverConfig)
			return serverConfig
		})
		.catch((err) => {
			console.log('[Error] ServerConfig', err)
		})

}

module.exports = scripts
