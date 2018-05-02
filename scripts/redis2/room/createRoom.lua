local _stringformat = string.format
local _unpack = unpack
local _tonumber = tonumber

--VALIDATION
if(not KEYS[1]) then return redis.error_reply('NO SESSION KEY') end
if(not KEYS[2]) then return redis.error_reply('NO ROOM NAME KEY') end
if(not KEYS[3]) then return redis.error_reply('NO NODE TIME KEY') end
if(not cjson.decode(ARGV[1])) then return redis.error_reply('NO ROOM DATA') end

--========================================================================
-- UTILITY Functions
--========================================================================

local createHexastore = function(key, subject,predicate,object)
    return redis.call('zadd', key,
        0,_stringformat("spo||%s||%s||%s",subject,predicate,object),
        0,_stringformat("sop||%s||%s||%s",subject,object,predicate),
        0,_stringformat("osp||%s||%s||%s",object,subject,predicate),
        0,_stringformat("ops||%s||%s||%s",object,predicate,subject),
        0,_stringformat("pos||%s||%s||%s",predicate,object,subject),
        0,_stringformat("pso||%s||%s||%s",predicate,subject,object))
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

--========================================================================
-- CORE Functions
--========================================================================
local sessionId 			= KEYS[1]
local clientRoomName 		= KEYS[2]
local nodeTime 				= _tonumber(KEYS[3])
local roomProps 			= cjson.decode(ARGV[1]) --todo: this needs optimizing (most likely)
local configUpdateTime 		= 5000 --todo: call settings redis table
local configMaxReserveTime	= 5000 --todo: call settings redis table

local rk = {
	countsRooms 	= "counts|rooms", --total # subscribed
	tickSessions 	= "tick|sessions",
	tickRooms      	= "tick|rooms",
	roomName       	= "rooms|"..KEYS[2],
	roomInfo        = "rooms|"..KEYS[2].."|info",
	roomMessages   	= "rooms|"..KEYS[2].."|messages",
	roomHistory    	= "rooms|"..KEYS[2].."|history",
	roomReserves	= "rooms|"..KEYS[2].."|reserves",
	openGameRooms	= "open|gameRooms"
}
local doesRoomExist 		= redis.call('exists', rk.roomName) == 1

--update session or return error when doesnt exist
if(redis.call('zadd', rk.tickSessions, 'XX', 'CH', 'INCR', nodeTime+configUpdateTime, sessionId) == 0) then
	return redis.error_reply('SESSION NOT FOUND')
end

--refresh and cleanup expired reservations
local expiredReserves = redis.call('zrangebyscore', rk.roomReserves, 0, nodeTime)
if(#expiredReserves > 0) then
	for x=1, #expiredReserves do
		removeHexReserve(expiredReserves[x], 'is-reserve-of', clientRoomName)
	end
end
redis.call('zremrangebyscore', rk.roomReserves, 0, nodeTime)
redis.call('pexpire', rk.roomReserves, configMaxReserveTime)

if(not doesRoomExist) then

	local numReserves = redis.call('zcard', rk.roomReserves)
	local roomType = roomProps.roomType
	local roomTypeId = roomProps.roomTypeId
	local createdTime = roomProps.createdTime
	local maxSubscribers = roomProps.maxSubscribers
	local maxObservers = roomProps.maxObservers
	local roomPath = roomProps.roomPath
	if(not maxSubscribers) then	return redis.error_reply('INVALID MAX SUBSCRIBERS') end

	--add room info
	local data = {}
	for k,v in pairs(roomProps) do
		if(v ~= nil) then
			data[#data+1] = k
			data[#data+1] = v
		end
	end
	local didSet = redis.call('hmset', rk.roomInfo, _unpack(data))
	if(not didSet) then	return redis.error_reply('INVALID PROPS SET') end

	--Add empty rows for each available seat in room or set them to seat reserved
	local openSeat = {}

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
	redis.call('zadd',rk.roomMessages, 1, cjson.encode({created = createdTime, by= sessionId}))

	--reset history if there (converted to list)
	if(redis.call('exists', rk.roomHistory) == 1) then	redis.call('del',rk.roomHistory) end

	--add history for session who created this room
	redis.call('zadd',rk.roomHistory, 1, sessionId)

	--add hexastore for room and room type
	createHexastore('hex|rooms:properties', clientRoomName, 'is-room-type', roomTypeId)

	--add/update to global room ticker
	redis.call('zadd',rk.tickRooms,nodeTime,clientRoomName)
	return redis.status_reply('CREATED OK')
end

return redis.status_reply('EXISTS OK')

