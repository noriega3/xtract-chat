local _stringformat = string.format
local _tostring = tostring
local _unpack = unpack
local _tonumber = tonumber

--VALIDATION
if(not KEYS[1] or not _tostring(KEYS[1])) then return redis.error_reply('NO ROOM PATH KEY') end
if(not KEYS[2] or not _tostring(KEYS[2])) then return redis.error_reply('NO SESSION KEY') end
if(not KEYS[3] or not _tonumber(KEYS[3])) then return redis.error_reply('NO NODE TIME KEY') end
if(ARGV[1] and not cjson.decode(ARV[1])) then return redis.error_reply('INVALID RESERVE PARAMS') end

--========================================================================
-- UTILITY Functions
--========================================================================

local addHexReserve = function(subject,predicate,object)
	return redis.call('zadd', 'hex|sessions:rooms',
		0,_stringformat("spo||%s||%s||%s", subject, predicate, object),
		0,_stringformat("sop||%s||%s||%s", subject, object, predicate),
		0,_stringformat("osp||%s||%s||%s", object, subject, predicate),
		0,_stringformat("ops||%s||%s||%s", object, predicate, subject),
		0,_stringformat("pos||%s||%s||%s", predicate, object, subject),
		0,_stringformat("pso||%s||%s||%s", predicate, subject, object))
end

--========================================================================
-- CORE Functions
--========================================================================

local clientRoomName  	= KEYS[1]
local sessionId  		= KEYS[2]
local nodeTime  		= _tonumber(KEYS[3])
local reserveParams		= ARGV[1] and cjson.decode(ARGV[1]) or {}

local rk = {
	countsRooms             = "counts|rooms", --for dashboard
	sessionsReserves 		= "reserves|path|",
	hexSessionsToRooms      = "hex|sessions:rooms",
	tickRooms               = "tick|rooms",
	tickSessions            = "tick|sessions",
	tickReserves            = "tick|reserves",
	session                 = "sessions|"..KEYS[2],
	sessionReserves         = "sessions|"..KEYS[2].."|reserves",
	roomName                = "rooms|"..KEYS[1],
	roomHistory             = "rooms|"..KEYS[1].."|history",
	roomMessages            = "rooms|"..KEYS[1].."|messages",
	roomInfo                = "rooms|"..KEYS[1].."|info",
	roomReserves            = "rooms|"..KEYS[1].."|reserves" --will hold expiration time
}

--update session or return error when doesnt exist
redis.call('zadd', rk.tickSessions, 'XX', nodeTime, sessionId)

local roomExists = redis.call('exists', rk.roomName) == 1 and redis.call('exists', rk.roomInfo) == 1
local isDestroying = redis.call('hexists', rk.roomInfo, 'destroying') == 1
if(isDestroying) then return redis.error_reply('ROOM DESTROYED') end

--TODO: LOGIC FOR FORCE SEAT CHECK
if(not roomExists) then
	return redis.error_reply('ROOM NO EXIST')
--[[	redis.call('hset', rk.sessionsReserves, sessionId, 'reserved:seat:'..seat)
	addHexReserve(sessionId,'is-reserve-of',clientRoomName)
	return 1]]
else --room exists
	local reserveExpireTime = _tonumber(redis.call('hget', rk.roomInfo, 'reserveExpireTime'))
	local searchTerm = 'open:seat:'
	local openSeats = redis.call('zrangebylex', rk.roomName, '['..searchTerm, '['..searchTerm..'\xff', 'LIMIT', 0, 1)
	local seat
	if(openSeats and openSeats[1]) then
		seat = _tonumber(openSeats[1]:sub(#searchTerm+1))
		if(not seat) then return redis.error_reply('INVALID SEAT') end
		redis.call('zadd', rk.roomName, 0, 'reserved:seat:'..seat)
		redis.call('zrem', rk.roomName, openSeats[1])
		redis.call('zadd', rk.roomReserves, _tonumber(nodeTime+reserveExpireTime), sessionId)
		addHexReserve(sessionId,'is-reserve-of',clientRoomName)
		return seat
	end
	return redis.error_reply('NO OPEN SEATS')
end
