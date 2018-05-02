const uuid4 	= require('uuid/v4')
//load all stores into this module so we only have to require /store to access all of them
const _isEqual		= require('lodash/isEqual')
const _get			= require('lodash/get')
const _toInteger	= require('lodash/toInteger')
const _toString		= require('lodash/toString')
const _stubObject	= require('lodash/stubObject')

const clients 	= require('./clients')
const queues 	= require('./queues')
const servers 	= require('./servers')
const database 	= require('./database')

//Shared functions
let _serverUuid, _config
const createStore = () => {
	_serverUuid = uuid4(process.env.SERVER_NAME)
}
const getServerName = () => _toString(process.env.SERVER_NAME)
const getUuid = () => _serverUuid
const getMaxBufferSize = () => _toInteger(process.env.TCP_CLIENT_BUFFER_SIZE)
const setConfig = (updated) => { _config = updated }
const getConfig = (key) => key ? _get(_config, key, false) : _config
const getMaintenanceMode = () => _isEqual(_get(_config, 'maintenanceMode', 1), 1)
const getAppNameList = () => _get(_config, 'appNameList', _stubObject)

//singleton
exports = module.exports = {
	createStore, getServerName, getUuid, getMaxBufferSize, setConfig, getConfig,
	getMaintenanceMode,getAppNameList,
	database, clients, queues, servers
}
