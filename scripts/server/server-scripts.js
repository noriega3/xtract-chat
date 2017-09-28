'use strict'
const debug     = require('debug')      //https://github.com/visionmedia/debug
const fs 		= require('fs')
const globals   = require('../../globals')
const _log      = debug('server-script')
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
		lua: fs.readFileSync("./scripts/events/updateSessionData.lua", "utf8")
	})

	client.defineCommand('expireSession', {
		numberOfKeys: 1,
		lua: fs.readFileSync("./scripts/redis/expireSession.lua", "utf8")
	})

	client.defineCommand('prepareRoomEvent', {
		numberOfKeys: 5,
		lua: fs.readFileSync("./scripts/redis/prepareRoomEvent.lua", "utf8")
	})

	client.defineCommand('incrServerTick', {
		numberOfKeys: 0,
		lua: fs.readFileSync("./scripts/events/incrServerTime.lua", "utf8")
	})

	client.defineCommand('getServerTick', {
		lua: fs.readFileSync("./scripts/events/getServerTime.lua", "utf8")
	})

	//Clear db 0 from last session
	dbClient.multi()
		.flushdb()
		.script('flush')
		.set('serverTime', Date.now())
		.exec()
		.tapCatch((err) => _error('err @ serverTime', err))
	globals.setVariable("SERVER_TIME", Date.now())
}

scripts.updateServerConfig = () => {
	return settingsClient.multi()
		.get('settings:_maintenanceMode')
		.get('settings:_nextMaintenance')
		.hgetall('settings:bots:enabledRooms')
		.hgetall('settings:maxSubscribersPerRoom') //renamed from maxUsersPerRoom v1
		.hgetall('settings:maxObserversPerRoom')
		.hgetall('settings:roomEvents')
		.smembers('settings:appNames')
		.exec()
		.then((configs) => {
			let serverConfig = {
				maintenanceMode: 		configs[0][1],
				nextMaintenance: 		configs[1][1],
				botEnabledRooms: 		configs[2][1],
				maxSubscribersPerRoom: 	configs[3][1], //renamed from maxUsersPerRoom v1
				maxObserversPerRoom: 	configs[4][1],
				roomEvents:      		configs[5][1] || [],
				appNameList:     		configs[6][1] || [],
			}

			//update global var
			globals.setVariable("SERVER_CONFIG", serverConfig)

			return serverConfig
		})
}

module.exports = scripts
