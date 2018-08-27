
import _ from 'lodash'
let socketList = []
/**
 * Create a WebSocket object from the incoming config
 */
export const createWebsocket = (payload) => {
	if(_.isEmpty(payload)) return false
	if(_.has(payload, 'client')) return payload.client
	const wsUrl = _.get(payload, 'url')
	const wsId = _.get(payload, 'wsId')
	let ws = {wsId, wsUrl}
	if(!wsUrl) return false

/*	//search if id is passed
	if(wsId){
		ws = _.find(socketList, {wsId})
		if(ws) return ws
	}*/

	//create new socket
	ws.client = new WebSocket(wsUrl)
	socketList.push(ws)
	return ws
}

export const findWebSocket = ({wsId}) => {
	return _.find(socketList, {wsId})
}

export const removeWebSocket = ({wsId}) => {
	if(_.isEmpty(wsId)) {
		console.log(wsId)
		console.log('empty client')
		return false
	}
	_.remove(socketList, function(currentObject) {
		return currentObject.wsId === wsId
	})
	console.warn('websocket list is now ', socketList)

}
