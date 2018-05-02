local _stringformat = string.format
local _tonumber = tonumber
local _mathrandom = math.random
local _unpack = unpack

local createHexastore = function(key, subject,predicate,object)
	return redis.call('zadd', key,
	0,_stringformat("spo||%s||%s||%s",subject,predicate,object),
	0,_stringformat("sop||%s||%s||%s",subject,object,predicate),
	0,_stringformat("osp||%s||%s||%s",object,subject,predicate),
	0,_stringformat("ops||%s||%s||%s",object,predicate,subject),
	0,_stringformat("pos||%s||%s||%s",predicate,object,subject),
	0,_stringformat("pso||%s||%s||%s",predicate,subject,object))
end

--Room properties
local roomType = -1
local sessionId = KEYS[1]
local clientRoomName = KEYS[2]
local currentTime = _tonumber(redis.call('get', 'serverTime'))

if(not currentTime) then
	return redis.error_reply('NO SERVERTIME')
end
local isBotsEnabled = _tonumber(KEYS[3])
local maxSubscribers = KEYS[4]
local maxObservers

local rk = {
	countsRooms 	= "counts|rooms",
	tickSessions    = "tick|sessions",
    tickRooms       = "tick|rooms",
	roomName        = "rooms|"..KEYS[2],
	roomInfo        = "rooms|"..KEYS[2].."|info",
    roomMessages    = "rooms|"..KEYS[2].."|messages",
    roomHistory     = "rooms|"..KEYS[2].."|history",
    --roomBots    	= "rooms|"..KEYS[2].."|bots",

	session         = "sessions|"..KEYS[1],
}
local doesRoomExist = redis.call('exists', rk.roomName) == 1

if(maxSubscribers == "LIMIT") then
	maxSubscribers = ARGV[1]
	maxObservers = ARGV[2]
end

--update session or return error when doesnt exist
if(redis.call('zadd', rk.tickSessions, 'XX', 'CH', 'INCR', currentTime, sessionId) == 0) then
	return redis.error_reply('SESSION NOT FOUND')
end

--add/update to global room ticker (-1 = no update)
redis.call('zadd',rk.tickRooms,-1,clientRoomName)

if(not doesRoomExist) then

	local openSeat = {}

	--add room info
    redis.call('hmset',rk.roomInfo,
        'roomName',clientRoomName,
        'roomType',"system",
        'roomTypeId',roomType,

        'nextMessageId',1,
	    'nextEventId',1,

	    'created',currentTime,
	    'creator',sessionId,
	    'updated',currentTime,

	    'subscribers', 0,
	    'maxSubscribers', maxSubscribers,

        'bots', 0,
        'maxBots', isBotsEnabled,

        'observers', 0,
        'maxObservers', maxObservers,

	    'validRoomEvents', cjson.encode({'checkSingleSession'}),

    	'roomHash', _mathrandom(currentTime, currentTime+45000))

	--Add empty rows for each available seat in room or set them to seat reserved
	for x=1, maxSubscribers do
		openSeat[#openSeat+1] = 0
		openSeat[#openSeat+1] = 'open:seat:'..x
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
	if(redis.call('exists', rk.roomHistory) == 1) then
		redis.call('del',rk.roomHistory)
	end

    --add history for session who created this room
    redis.call('zadd',rk.roomHistory, 1, sessionId)

	--update counts to 0
	redis.call('zadd', rk.countsRooms, 0, clientRoomName)

    --add hexastore for room and room type
	createHexastore('hex|rooms:properties', clientRoomName, 'is-room-type', roomType)
end

--update the session who created the room
if(redis.call('hexists', rk.session, 'updated') == 1) then
	redis.call('hset', rk.session,'updated', currentTime)
end

return redis.status_reply('OK')
