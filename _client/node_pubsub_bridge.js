//Init the queue listeners
require('../queues/pubsub_rooms')
require('../queues/pubsub_sessions')

const uuid4         = require('uuid/v4')    //https://github.com/broofa/node-uuid
const uuid5         = require('uuid/v5')    //https://github.com/broofa/node-uuid
const debug         = require('debug')      //https://github.com/visionmedia/debug
const buffer         = require('buffer')      //https://github.com/visionmedia/debug
const _log          = debug('ps_bridge')
const globals       = require('../globals')
const Sockets       = globals.sockets
const redisManager  = require('../scripts/redis_manager')
const helper = require("../utils/helpers");
const roomSubQueue  = redisManager.roomSubQueue
const roomQueue     = redisManager.roomQueue
const sessionQueue  = redisManager.sessionQueue
const maxBufferSize    = globals.getVariable("BUFFER_SIZE")
const serverName    = globals.getVariable("SERVER_NAME")
const serverUuid    = uuid4(serverName)
const addConfig = {
    attempts: 3,
	timeout: 5000,
	removeOnComplete: true
}


const helpers = {
    removeInitsFromBuffer: (socket) => {
        //remove any outstanding inits
        let initStart = socket.buffer.indexOf("__INIT__")
        let initEnd = socket.buffer.indexOf('__ENDINIT__')

        if(initStart !== -1 && initEnd !== -1){
            //remove the init from the buffer
            let sliced = socket.buffer.slice(initStart,initEnd+11)
            sliced.fill(0)
            socket.bufferLen -= (initStart+initEnd+11)
            return helpers.removeInitsFromBuffer(socket)
        } else {
            return socket.buffer
        }
    },
    setupInit: (socket) => {
        //ensure we are getting the last init of the buffer
        const initStart = socket.buffer.lastIndexOf('__INIT__')
        const initEnd = socket.buffer.lastIndexOf('__ENDINIT__')
        let sliced = socket.buffer.slice(initStart,initEnd+11)

        if(initStart !== -1 && initEnd !== -1){
            const bufStr        = socket.buffer.toString('utf8',initStart+8,initEnd)
			_log('json sub setup init', bufStr)

			const playerData    = bufStr && helper._isJson(bufStr) ? JSON.parse(bufStr) : {}


			//return helpers.removeInitsFromBuffer(socket)
            sliced.fill(0)
            socket.bufferLen -= (initStart+initEnd+11)
			return sessionQueue.add('init',{sessionId: socket.sessionId, playerData: playerData }, {...addConfig})
		}
    },
    disconnectSocket: (sessionId) => {

        let socket = Sockets.getSocketBySessionId(sessionId)

        _log("[Alert]: disconnecting socket by request")

    },
    checkServerStatus: (socket) => {
        if(globals.getVariable("isMaintenanceMode")){
            socket.end("FAIL") //send fail to client requesting it it.
            socket.destroy()
        } else {
			const initEnd = socket.buffer.lastIndexOf('__STATUS__')
			let sliced = socket.buffer.slice(initEnd+11)
			sliced.fill(0)
            socket.bufferLen -= initEnd+10
            socket.resume()
            Sockets.writeToSocket(socket, "OK")
        }
        return true
    }
}

const onSocketData = (socket, dataRaw) => {
    //socket.pause()

    //ensure that the data received is not over the unallocated size of the buffer
    if(dataRaw.length > (maxBufferSize - socket.bufferLen)){
        _log("[Alert]: the data received is larger than what the buffer size allows")
        socket.bufferLen = 0
        return false
    }

    //append this data received to the client's buffer, and set the new length
    socket.bufferLen += dataRaw.copy(socket.buffer, socket.bufferLen)
    //the size is predefined, so any slices will cut the available amount to use.
    socket.buffer = socket.buffer.slice(0, maxBufferSize)

    //Ensure user did not send an __ENDCONNECTION__ flag in this buffer
    const toEndConnection = socket.buffer.includes("__ENDCONNECTION__")
    if(toEndConnection) return onSocketClose(socket.end("CLOSED"))

    //Check if this client is just checking the status
    if (socket.buffer.includes("__STATUS__")) return helpers.checkServerStatus(socket)
    if (globals.getVariable("isMaintenanceMode")) return onSocketClose(socket.destroy())

    //Init or resume client based on values send in
    helpers.setupInit(socket)

	//Extract the json string from buffer
    let parseJson = (buf) => {

        //Unlike init, we start from beginning of buffer
        let jsonStart = buf.indexOf('__JSON__START__')
        let jsonEnd = buf.indexOf('__JSON__END__')

        if(jsonStart !== -1 && jsonEnd !== -1){

            let bufStr = buf.toString('utf8',jsonStart+15,jsonEnd)
			_log('json intent', bufStr)

            let data = bufStr && helper._isJson(bufStr) ? JSON.parse(bufStr) : {}
            let intent = (data && data.intent) ? data.intent : false

            _log('[Request]', bufStr)

            //Determine route based on intent
            switch(intent){
                case "subscribe":
					roomSubQueue.add('subscribe',{sessionId: socket.sessionId, room: data.roomName, params:data.params }, {...addConfig})
                    break
                case "unsubscribe":
					roomSubQueue.add('unsubscribe',{sessionId: socket.sessionId, room: data.roomName, params:data.params },{...addConfig})
                    break
                case "disconnect":
                    helpers.disconnectSocket(sessionId)
                    break
                case "keepAlive":
                    sessionQueue.add('keepAlive',{sessionId: socket.sessionId, params:data.params }, addConfig)
                    break
                case "syncSessionData":
                    roomQueue.add('prepareSyncSessionData',{sessionId: socket.sessionId, params:data }, addConfig)
                    break
                case "sendChatToRoom":
                    roomQueue.add('sendChatToRoom',{sessionId: data.sessionId, userId: data.userId, room: data.room, message: data.message, eventId: data.eventId }, {priority: 1, ...addConfig})
                    break
                case "sendRoomEvent":
                    roomQueue.add('prepareRoomEvent',{sessionId: socket.sessionId, params:data}, addConfig)
                    break
                case "eventConfirm":
                    roomQueue.add('verifyRoomEvent',{sessionId: socket.sessionId, eventId: data.eventId }, {priority: 2, ...addConfig})
                    break
                default:
                    _log("No intent defined for data: ", data)
                    break
            }

            //take out the json, and rerun the function to ensure we have executed all the json in the buffer
            let sliced = socket.buffer.slice(jsonStart,jsonEnd+13)
            sliced.fill(0)
            return parseJson(socket.buffer)
        } else {
            return false
        }
    }

    parseJson(socket.buffer)
    _log('[Data Finish]', socket.bufferLen)
	const buf2 = Buffer.from(socket.buffer);
	_log('[Data Buf String]:', buf2.toString())
    socket.resume()
}

const onSocketError = (sessionId) => {
    let socket = Sockets.getSocketBySessionId(sessionId)

    //TODO: redis ensure redis instance is valid before settings timers
    //TODO: redis set expiration on client to 10 - turn based
    //TODO: redis set expiration on client to 30 - non-turn based
}

const onSocketClose = (sessionId) => {

    sessionQueue.add('destroy', {sessionId: sessionId}, {...addConfig})

    setImmediate(() => {
        let socket = Sockets.getSocketBySessionId(sessionId)
        _log('[Closed Socket]: %s', sessionId)
        //socket.pause()

        socket.destroy()
        Sockets.deleteSocketBySessionId(sessionId)
    })
}

const onSocketTimeout = (sessionId) => {
    let socket = Sockets.getSocketBySessionId(sessionId)

    //TODO: redis set flag that user expired, set a timer from here to allow them one more turn on turn based or x seconds
}


/**
 * Main function, handles a creation of a socket instance, and bridges the connection with a redis instance
 * @param socket
 */
function clientBridge(socket){

    //Set the configs for the socket
    socket.setNoDelay(true)
    socket.setKeepAlive(true, 300 * 1000)
    socket.isConnected = true

    const remoteIp = socket.remoteAddress + ':' + socket.remotePort
    let sessionId = uuid5(remoteIp,serverUuid)

	_log('new session id is: %s', sessionId)

    socket.serverVersion    = 2
    socket.sessionId        = sessionId
    socket.name             = remoteIp
    socket.state            = "connecting" //set state to connection aka init
    socket.buffer           = Buffer.allocUnsafe(maxBufferSize).fill(0) //create a buffer for the socket with the max size defined
    socket.bufferLen        = 0

    _log('[Open Socket]: %s | %s', socket.name, sessionId)
    //_log('[Buffer Length]: %s', socket.bufferLen)

    //socket.setEncoding('utf-8') //TODO: check if this will cause processing we dont need
    socket.on('data', (rawData) => onSocketData(socket,rawData))
    socket.on('error', (e) => onSocketError(sessionId,e))
    socket.on('close', () => onSocketClose(sessionId))
    socket.on('timeout', () => onSocketTimeout(sessionId))

    socket.resume()

	Sockets.addSocket(socket)
	//globals.pushVariable("clientSocketsList", socket)

	return socket
}

module.exports = clientBridge
