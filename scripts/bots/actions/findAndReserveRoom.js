const debug         = require('debug')      //https://github.com/visionmedia/debug
const _log          = debug('bot:findAndReserve')
const _error        = debug('bot:findAndReserve:err')
debug.log = console.info.bind(console) //one all send all to console.

const _has = require('lodash/has')
const request 		= require('request')
const HTTP_PORT		= process.env.HTTP_SERVER_PORT

module.exports = function(roomPath, params = {}){
	const client = this
	const emitter = this.getEmitter()
	const sessionId = this.getSessionId()

	if(client._state === "disconnecting") return

	const dataToSend = {
		sessionId: sessionId,
		roomName: roomPath,
		params: params,
		appName: params.appName,//for validation
		userId:	client.getUserData().userId, //for validation
	}

	new request({
		method: 'POST',
		url: `http://localhost:${HTTP_PORT}/api/v1/room/reserve`,
		json:true,
		body: dataToSend,
	}, (err, response, resBody) => {
		if(_has(resBody, 'error'))
			_error('err', resBody)
		else
			emitter.emit('reservation', resBody.response)
	})
}
