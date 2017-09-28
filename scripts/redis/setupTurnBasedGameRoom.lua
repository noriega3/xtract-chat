local _stringformat = string.format
local _tonumber = tonumber
local _mathrandom = math.random
local _unpack = unpack

local createHexastore = function(subject,predicate,object)
    return
        0,_stringformat("spo||%s||%s||%s",subject,predicate,object),
        0,_stringformat("sop||%s||%s||%s",subject,object,predicate),
        0,_stringformat("osp||%s||%s||%s",object,subject,predicate),
        0,_stringformat("ops||%s||%s||%s",object,predicate,subject),
        0,_stringformat("pos||%s||%s||%s",predicate,object,subject),
        0,_stringformat("pso||%s||%s||%s",predicate,subject,object)
end

local removeHexReserve = function(subject,predicate,object)
	return redis.call('zrem', 'hex|sessions:rooms',
	_stringformat("spo||%s||%s||%s", subject, predicate, object),
	_stringformat("sop||%s||%s||%s", subject, object, predicate),
	_stringformat("osp||%s||%s||%s", object, subject, predicate),
	_stringformat("ops||%s||%s||%s", object, predicate, subject),
	_stringformat("pos||%s||%s||%s", predicate, object, subject),
	_stringformat("pso||%s||%s||%s", predicate, subject, object))
end

--Room properties
local roomType = 2
local sessionId = KEYS[1]
local clientRoomName = KEYS[2]
local roomArr = cjson.decode(KEYS[3])
local currentTime           = redis.call('get', 'serverTime')

if(not currentTime) then
	return redis.error_reply('NO SERVERTIME')
end
local updateTime = currentTime+45000
local isBotsEnabled = _tonumber(KEYS[4])
local maxSubscribers = KEYS[5]
local maxObservers

local rk = {
    countsRooms 	= "counts|rooms",
	countsRoomPath  = "counts|"..roomArr['roomPath'],
	tickSessions 	= "tick|sessions",
	tickRooms      	= "tick|rooms",
	roomName       	= "rooms|"..KEYS[2],
	roomInfo       	= "rooms|"..KEYS[2].."|info",
	roomMessages   	= "rooms|"..KEYS[2].."|messages",
	roomHistory    	= "rooms|"..KEYS[2].."|history",
    roomBots    	= "rooms|"..KEYS[2].."|bots",
	roomReserves	= "rooms|"..KEYS[2].."|reserves",

	session     	= "sessions|"..KEYS[1],
}
local doesRoomExist = redis.call('exists', rk.roomName) == 1

if(maxSubscribers == "LIMIT") then
	maxSubscribers = ARGV[1]
	maxObservers = ARGV[2]
end

--update session or return error when doesnt exist
if(redis.call('zadd', rk.tickSessions, 'XX', 'CH', 'INCR', currentTime, sessionId) == 0) then
	return redis.error_reply('no session')
end

--add/update to global room ticker
redis.call('zadd',rk.tickRooms,updateTime,clientRoomName)

--refresh and cleanup expired reservations
local expiredReserves = redis.call('zrangebyscore', rk.roomReserves, 0, currentTime)
for x=1, #expiredReserves do
	removeHexReserve(expiredReserves[x], 'is-reserve-of', clientRoomName)
end
redis.call('zremrangebyscore', rk.roomReserves, 0, currentTime)

if(not doesRoomExist) then

	local numReserves = redis.call('zcard', rk.roomReserves)
	local openSeat = {}

	--add room info
	redis.call('hmset', rk.roomInfo,
	'roomName', clientRoomName,
	'roomPath', roomArr['roomPath'],
	'roomId', roomArr['roomId'],
	'roomType', "gameRoom",
	'roomTypeId', roomType,

	'nextMessageId',1,
	'nextEventId',1,

	'created', currentTime,
	'creator', sessionId,
	'updated', currentTime,

	'subscribers', 0,
	'maxSubscribers', maxSubscribers,

	'bots', 0,
	'maxBots', isBotsEnabled,

	'observers', 0,
	'maxObservers', maxObservers,

	'validRoomEvents', cjson.encode({ 'turnStart', 'turnEnd', 'gameStart', 'gameEnd', 'gamePause', 'gameStatus' }),

	--turn based
	'gameHash', _mathrandom(currentTime, updateTime), --turn (unique hash to use for game data like a deck)
	'gameState', "CREATED", -- turn (AUTO_MATCHING, ACTIVE, COMPLETE, CANCELLED, EXPIRED)
	'gamesCompleted', 0, -- turn
	'gameId', 0, -- turn
	'turnSeatIndex', 0, -- turn
	'turnExpireAt', 0 -- turn
	)

	--Add empty rows for each available seat in room or set them to seat reserved
	for x=1, maxSubscribers do
		openSeat[#openSeat+1] = 0
		openSeat[#openSeat+1] = x <= numReserves and 'reserved:seat:'..x or 'open:seat:'..x
	end

	if(maxObservers) then
		--Add empty rows for each available observers in room
		for x=1, maxObservers do
			openSeat[#openSeat+1] = 0
			openSeat[#openSeat+1] = 'open:observer:'..x
		end
	end
	redis.call('zadd', rk.roomName, _unpack(openSeat))

	--add room messages, and add a created row
	redis.call('zadd',rk.roomMessages, 1, cjson.encode({created = currentTime}))

	--reset history if there
	redis.call('del', rk.roomHistory)

	--add history for session who created this room
	redis.call('zadd',rk.roomHistory, 1, sessionId)

	--update counts to 0
	redis.call('zadd', rk.countsRoomPath, 0, clientRoomName)
	redis.call('zadd', rk.countsRooms, 0, clientRoomName)

	--add hexastore for room and room type
	redis.call('zadd', 'hex|rooms:properties', createHexastore(clientRoomName, 'is-room-type', roomType))
end

--update the session who created the room
redis.call('hset', rk.session,'updated', currentTime)

return redis.status_reply('OK')
