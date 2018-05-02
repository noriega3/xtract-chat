const debug         = require('debug')      //https://github.com/visionmedia/debug
const _log          = debug('bot:reserveRoom')
const _error        = debug('bot:reserveRoom:err')
debug.log = console.info.bind(console) //one all send all to console.

const request 		= require('request')
const disconnect = require('./disconnect')
const requestSubscribe = require('./requestSubscribe')
const HTTP_PORT		= process.env.HTTP_SERVER_PORT
const helper = require("../../../util/helpers")

module.exports = function(roomName, params = {}){
	const client = this
	const emitter = this.getEmitter()
	const sessionId = this.getSessionId()
	const userId = this.getUserData().userId

	if(client._state === "disconnecting") return

	const roomArr = helper._roomNameToArr(roomName)

	const dataToSend = {
		sessionId,
		userId,
		roomName,
		params,
		appName: roomArr.roomAppName,
		isSimulator: false,
	}

	_log('port', HTTP_PORT)
	new request({
		method: 'POST',
		url: `http://localhost:${HTTP_PORT}/api/v1/room/reserve`,
		json:true,
		body: dataToSend,
	}, (err, response, resBody) => {

		_log('reservation bot', resBody)

		// body is the decompressed response body
		if(err){
			disconnect('end', err.toString())

		} else if(resBody && resBody.error){
			_error('err', resBody)
		} else {
			emitter.emit('reservation', resBody.response)
			requestSubscribe(resBody.response.roomName, resBody.response.params)
		}

	})

}
