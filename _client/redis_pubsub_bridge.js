
const debug         = require('debug') //https://github.com/visionmedia/debug
const Promise       = require('bluebird')
const _log          = debug('redis_ps_bridge')
const _error        = debug('ps_redis_err')
const globals       = require('../globals')
const helper       = require('../utils/helpers')
const Sockets       = globals.sockets
const redisManager  = require('../scripts/redis_manager')
const Subscriber    = redisManager.subscriber

/****
 * Redis pub/sub per node server
 */
Subscriber.psubscribe('sessions|*','rooms|*','bot|*')
Subscriber.on('pmessage', (pattern, channel, message) => {

	const parsed = message && helper._isJson(message) ? JSON.parse(message) : {}


	if(pattern === 'rooms|*'){

		_log('json roomms', message)

        if(helper._isObject(parsed) && parsed.sessionIds && parsed.sessionIds.length > 0) {
			const sessionIds = parsed.sessionIds
			let fullMessage = ""

        	if(parsed.messages){
				//TODO: fix the buffer max
				//multiple messages
				Promise.map(parsed.messages, (msg) => {
					_error(msg)


					fullMessage = "__JSON__START__"+JSON.stringify(msg)+"__JSON__END__"
					//Sends the message to the appropriate socket on the appropriate server that has the sessionid
					return Promise.resolve(Sockets.getSocketsBySessionIds(sessionIds))
						.map((socket) => {
							socket.resume()

							return Sockets.writeToSocket(socket, fullMessage).then((result) => {
								if(result === 'undefined'){
									_log('bad socket', socket.sessionId)
								}
								return result
							})
						})
						.then((results) => {
							//TODO: add retries here
						})
				})

			} else if(parsed.message){
				_log('json single message', parsed.message)

        		const dataToSend = JSON.stringify(parsed.message)

				//a single message
        		fullMessage = "__JSON__START__"+dataToSend+"__JSON__END__"

				//Sends the message to the appropriate socket on the appropriate server that has the sessionid
				Promise.resolve(Sockets.getSocketsBySessionIds(sessionIds))
					.mapSeries((socket) => {
						socket.resume()

						return Sockets.writeToSocket(socket, fullMessage).then((result) => {
							if(result === 'undefined'){
								_log('bad socket', socket.sessionId)
							}
							return result
						}).tap((result) => {
							_log('-------------')
							_log('[Session]: %s', socket.sessionId)
							_log('[Pattern]: %s', pattern)
							_log('[Channel]: %s', channel)
							_log('[Result]: %s', result)
							_log('#-------------')

						})
					})
					.then((results) => {


						//TODO: add retries here
					})
			}
        }

    }

    if(pattern === 'sessions|*'){
		_log('json sessions', message)


		if(helper._isObject(parsed) && parsed.sessionId) {
            const sessionId = parsed.sessionId
            const parsedMsg = parsed.message

            if(parsedMsg && parsedMsg.serverReqTime){
                parsedMsg.serverLatency = (Date.now() - parsedMsg.serverReqTime)
            }
            const message = JSON.stringify(parsedMsg)

			_log('-------------')
			_log('[Pattern]: %s', pattern)
			_log('[Channel]: %s', channel)
			_log('[Message]: %s', message)
			_log('[Phase]: %s', parsed.message.phase)
			_log('#-------------')

            //Sends the message to the appropriate socket on the appropriate server that has the sessionid
            Promise.resolve(Sockets.writeToSessionId(sessionId, "__JSON__START__" + message + "__JSON__END__"))
                .then((result) => {
                    if(result === 'undefined') {
                        _log('bad socket', socket.sessionId)

                    }
                })
        }
    }

	if(pattern === 'bot|*'){

		_log('-------------')
		_log('[Pattern]: %s', pattern)
		_log('[Channel]: %s', channel)
		_log('[Message]: %s', message)
		_log('#-------------')

		_log('json bot', message)


		if(helper._isObject(parsed) && parsed.sessionId) {
			const sessionId = parsed.sessionId


			//Sends the message to the appropriate socket on the appropriate server that has the sessionid
			Promise.resolve(
				Sockets.writeToSessionId(sessionId, "__JSON__START__" + message + "__JSON__END__")
			)
				.then((result) => {
					if(result === 'undefined') {
						_log('bad socket', socket.sessionId)

					}
				})
		}
	}
})
