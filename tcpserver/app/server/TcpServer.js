const debug 	= require('debug') //https://github.com/visionmedia/debug
debug.log = console.info.bind(console) //one all send all to console.
const _log 		= debug('tcpServer')
const _error 	= debug('tcpServer:err')

//npm/node modules
const Promise 	= require('bluebird') //http://bluebirdjs.com/docs/api-reference.html
const net		= require('net') //https://nodejs.org/api/net.html

const _invokeMap = require('lodash/invokeMap')
const _isEqual = require('lodash/isEqual')

const SERVER_NAME 	= process.env.SERVER_NAME
const TCP_PORT 		= process.env.TCP_SERVER_PORT

const TcpClient		= require('../client/TcpClient')
const store			= require('../store')
const servers		= store.servers
const clients		= store.clients

const _identifier = 'TcpServer'

_log('[Init] %s - TcpServer', SERVER_NAME)

const TcpServer = () => {
	const _nodeServer = net.createServer({ pauseOnConnect: true })

	const _closeServer = () => {
		const sendMessages = () => {
			_invokeMap(clients.getClients(), 'send', JSON.stringify({
				phase: 'disconnected',
				room: 'Server',
				serverTime: Date.now(),
				message: 'Server shutting down.',
				response: {
					serverTime: Date.now(),
					sessionId: 'server'
				}
			}))
			return 'OK'
		}
		return Promise.all([sendMessages()])
			.then(() => {
				if(!_nodeServer) throw new Error('[Server] Already Closed')
				return new Promise((resolve, reject) => {
					_nodeServer.unref()
					_nodeServer.close((srvErr) => {
						if(srvErr)
							reject(new Error('failed to close node server ' + srvErr.toString()))
						else {
							console.log('closed w/out error pubsub')
							resolve()
						}
					})
				})
			})
			.finally(() => {
				if (servers.hasServer(_identifier)) servers.removeServerById(_identifier)
			})
			.return('OK')
			.catch((err) => {
				_error('[Error]: On Node Close\n%s', err.toString())
				process.exitCode = 1
			})
	}

	_nodeServer.on('connection', TcpClient)

	_nodeServer.on('close', (exitCode) => {
		_log('[On Node Close] Code: %s', exitCode)
		_log('[Server] Closed on port: %s %s', TCP_PORT, SERVER_NAME)
	})

	_nodeServer.on('error', (e) => {
		if (_isEqual(e.code, 'EADDRINUSE')) {
			_error('[Error]: Address in use, retrying...')
			setTimeout(() => { _nodeServer.close(() => _nodeServer.listen(TCP_PORT, '::')) }, 1000)
		} else {
			_error('[Error]: General\n%s', e.message)
			_closeServer(e)
		}
	})

	_nodeServer.on('listening', () => {
		const {address = 'n/a', port = -1, family = 'n/a'} = _nodeServer.address()
		_log('[Server] Listening on port: %s %s %s %s', address, port, family, SERVER_NAME)
	})

	return servers.addServer({
		_identifier,
		getServer() { return _nodeServer},
		start() { console.log('start listening'); return _nodeServer.listen(TCP_PORT, '::')},
		close() { return _closeServer()}
	})
}

module.exports = TcpServer
