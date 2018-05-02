const debug         = require('debug') //https://github.com/visionmedia/debug
debug.log = console.info.bind(console) //one all send all to console.
const store			= require('../../store')
const _log 			= debug('tick')
const _error 		= debug('tick:err')

const Promise		= require('bluebird')

const getConnection = store.database.getConnection

const _isEqual = require('lodash/isEqual')
const RoomActions 	= require('../room/shared')

//TODO: look into pausing queue again when rooms are empty, then resuming when we have tick via session/room queue
const hasRooms = () => {
	return Promise.using(getConnection(), (client) => {
		return client.exists('tick|rooms', (err, result) => _isEqual(1, result))
	})
}

const removeIdleRooms = () => {
	const nodeTime = Date.now()
	return Promise.using(getConnection(), (client) => {
		return client.idleRooms(nodeTime, 10000)
			.each((foundName) => {
				const roomName = foundName
				//can either use a job or do it all at once
				return client.checkIdleRoom(roomName, nodeTime).then((status) => {
					if (_isEqual('IDLE', status))
						return RoomActions.destroyRoom(roomName)
					else
						return status
				})
			})
	})
}

module.exports = function(job){
		process.title = 'node_tick'

	/*
            const checkExpires = () => {
                const serverTime = Date.now()
                const expiredTime = 60000 //60 sec expiration without an update
                let roomList = []
                let multi
                //move expired ones to another table for processing
                return client.zrangebyscore('tick|rooms', '(0', serverTime-expiredTime, 'LIMIT', 0, 25)
                    .tap((rooms)=> {
                        multi = client.multi()
                    })
                    .each((roomName) => {
                        multi.zadd('expires|rooms', 0, roomName)
                        //get all sessions in the room w/ roomType
                        return Promise.resolve(RoomActions.findAndDestroyRoom(roomName))
                    })
                    .tap(() => {
                        if(roomList.length > 0){
                            return multi.exec()
                        } else {
                            multi.discard()
                            return []
                        }
                    })
                    .then((result) => {
                        return result
                    })
                    .tapCatch((err) => {
                        if(_.has(multi,'discard')) multi.discard()
                        _error('err @ tick expire', err)
                    })
            }

            const checkRoomStates = () => {
                const serverTime = Date.now()

                return client.zrangebyscore('tick|rooms', '(0', serverTime-800, 'LIMIT', 0, 25)
                    .each((roomName) => {
                        const roomInfoKey = helper._bar('rooms', roomName, 'info')
                        return client.hmget(roomInfoKey, 'roomTypeId', 'nextMessageId')
                            .then(([roomType, nextMessageId]) => {
                                switch(_.toNumber(roomType)){
                                    case REALTIME_ROOM_TYPE:
                                        return realTimeActions.processTickEvent(roomName, serverTime, nextMessageId)
                                    case TURNBASED_ROOM_TYPE:
                                        return turnBasedActions.processTickEvent(roomName, serverTime, nextMessageId)
                                    default:
                                        return 'OK'
                                }
                            })

                    })
                    .then((results) => {
                        return 'OK'
                    })
                    .tapCatch((err) => {
                        _error('err @ tick state', err)
                    })
            }*/
	return Promise.props({hasRooms: hasRooms()})
		.then(({hasRooms}) => {
			if(!hasRooms) return 'OK'
			return Promise.all([
				removeIdleRooms()//,
				//checkExpires(),
				//checkRoomStates(),
				//sendPush()
			])
			//.finally(() => queue.resume())
		})
		.tap((results) => {
			console.log('done processing', results)
		})
		.return('OK')
		.tapCatch((err) => console.log('ERROR @ TICK', err.toString()))}


