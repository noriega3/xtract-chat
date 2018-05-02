const uuid4         = require('uuid/v4')    //https://github.com/kelektiv/node-uuid
const size       	= require('lodash/size')
const invoke       	= require('lodash/invoke')
const concat       	= require('lodash/concat')
const remove       	= require('lodash/remove')
const includes     	= require('lodash/includes')
const invokeMap    	= require('lodash/invokeMap')
const find    		= require('lodash/find')
const result    	= require('lodash/result')
const filter    	= require('lodash/filter')
const isEqual    	= require('lodash/isEqual')
const has    		= require('lodash/has')
const debug         = require('debug') //https://github.com/visionmedia/debug
const _log          = debug('clients')
const _error        = debug('error')

let _servers 		= []

//*************************************************************
const reset = () => { _servers = [] }

const getServer = (idSearch) => {
	if(idSearch) return find(_servers, ({_identifier}) => includes(idSearch, _identifier))
	else return _servers
}
const getServers = (idSearch) => {
	if(idSearch) return filter(_servers, ({_identifier}) => includes(idSearch, _identifier))
	else return _servers
}

const hasServer = (idSearch) =>	includes(_servers, {_identifier: idSearch})

const removeServer = (Server) => {

	return size(remove(_servers, Server))
}
const removeServerById = (idSearch) => {
	const _serverFound = find(_servers, ({_identifier}) => isEqual(idSearch, _identifier))
	_log('[Server] Removing server from store %s', idSearch)
	if(_serverFound) return removeServer(_serverFound)
	return false
}

const addServer = (Server) => {
	const _server = Server.getServer()

	//ensure there is a socket
	if(!_server) {
		_error('Invalid server instance found')
		return false
	}

	//add to list
	_servers = concat(_servers, Server)
	return Server
}


module.exports = {
	reset,
	getServers,
	addServer,
	removeServer,
	removeServerById,
	hasServer,
	getServer
}
