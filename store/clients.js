const concat       	= require('lodash/concat')
const remove       	= require('lodash/remove')
const includes     	= require('lodash/includes')
const find    		= require('lodash/find')
const result    	= require('lodash/result')
const filter    	= require('lodash/filter')
const isEqual    	= require('lodash/isEqual')
const debug         = require('debug') //https://github.com/visionmedia/debug
const _log          = debug('clients')
const _error        = debug('error')
let _clients 		= []

const reset = () => { _clients = [] }

const getClients = (idSearch) => {
	if(idSearch) return filter(_clients, ({_identifier}) => includes(idSearch, _identifier))
	else return _clients
}

const getSize = () => _clients.length

const addClient = (Client) => {
	let socket = 	result(Client, 'getSocket')
	let sessionId = 	result(Client, 'getSessionId')
	let clientType = 	result(Client, 'getClientType')
	_log('[Client] Adding', sessionId, clientType)

	//ensure there is a socket
	if(!socket) {
		_error('Invalid socket found for client')
		return false
	}
	//add to list
	_clients = concat(_clients, Client)
	_log('[Clients] size', _clients.length)
	return Client
}

const removeClient = (Client) => {
	if(!Client) {
		_log('no client found')
		return false
	}
	remove(_clients, Client)
	_log('[Clients] size after remove', _clients.length, _clients)
	return true
}

const removeClientById = (idSearch = '') => {
	_log('identifier to find', idSearch)
	const _clientFound = find(_clients, ({_identifier}) => isEqual(idSearch, _identifier))
	_log('found client', _clientFound)
	if(_clientFound) return removeClient(_clientFound)

	_log('[Clients] size after remove by id', _clients.length, _clients)
	return false
}

const getClientsByIds = (idsToSearch = []) => {
	const _foundClients = filter(_clients, ({_identifier}) => includes(idsToSearch, _identifier))
	if(!_foundClients) return []
	return _foundClients
}

const getClientsByServerType = (typeSearch) => {
	const _foundClients = filter(_clients, ({_type}) => isEqual(typeSearch, _type))
	if(!_foundClients) return []
	return _foundClients
}

const getSocketById = (idSearch) => result(find(_clients, ({_identifier}) => includes(idSearch, _identifier)), 'getSocket')

module.exports = {
	reset,
	getClients,
	addClient,
	getSize,
	removeClient,
	removeClientById,
	getClientsByIds,
	getSocketById
}
