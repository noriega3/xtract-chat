local _stringformat = string.format
local _tostring = tostring
local _unpack = unpack
local _tonumber = tonumber

--VALIDATION
if(not KEYS[1] or not _tostring(KEYS[1])) then return redis.error_reply('NO ROOM PATH KEY') end
if(not KEYS[2] or not _tostring(KEYS[2])) then return redis.error_reply('NO SESSION KEY') end
if(not KEYS[3] or not _tonumber(KEYS[3])) then return redis.error_reply('NO NODE TIME KEY') end
if(ARGV[1] and not cjson.decode(ARV[1])) then return redis.error_reply('INVALID CHECK RESERVE PARAMS') end

--========================================================================
-- UTILITY Functions
--========================================================================

--removes the hex reservation
local removeHexReserve = function(subject,object)
	return redis.call('zrem', 'hex|sessions:rooms',
		_stringformat("sop||%s||%s||%s", subject, object, 'is-reserve-of'),
		_stringformat("spo||%s||%s||%s", subject, 'is-reserve-of', object),
		_stringformat("ops||%s||%s||%s", object, 'is-reserve-of', subject),
		_stringformat("osp||%s||%s||%s", object, subject, 'is-reserve-of'),
		_stringformat("pso||%s||%s||%s", 'is-reserve-of', subject, object),
		_stringformat("pos||%s||%s||%s", 'is-reserve-of', object, subject))
end

local checkRoomExistence = function(roomName)
	return redis.call('exists', 'rooms|'..roomName) == 1 and
		redis.call('exists', 'rooms|'..roomName..'|info') == 1 and
		redis.call('hexists', 'rooms|'..roomName..'|info', 'destroying') == 0
end

local checkRoomSubscribeTypeReserves = function(roomName)
	return redis.call('hget', 'rooms|'..roomName..'|info', 'roomSubscribeType') == 'reserves'
end

local refreshRoomReserves = function(roomName, nodeTime)
	local reservesKey = 'rooms|'..roomName..'|reserves'
	--if(redis.call('exists', reservesKey) == 0) then return false end
	local expiredReserves = redis.call('zrangebyscore', reservesKey, 0, nodeTime)
	if(#expiredReserves > 0) then
		for x=1, #expiredReserves do
			removeHexReserve(expiredReserves[x],roomName)
		end
		redis.call('zremrangebyscore', reservesKey, 0, nodeTime)
	end
	return redis.call('exists', reservesKey) == 1
end

--========================================================================
-- CORE Functions
--========================================================================

local clientRoomName	= KEYS[1]
local sessionId         = KEYS[2]
local nodeTime		    = _tonumber(KEYS[3])
local checkFlags		= ARGV[1] and cjson.decode(ARGV[1]) or {}

local rk = {
	countsRooms             = "counts|rooms",
	tickRooms               = "tick|rooms",
	tickSessions            = "tick|sessions",
	session                 = "sessions|"..sessionId,
	sessionSubs             = "sessions|"..sessionId.."|rooms",
	sessionHistory          = "sessions|"..sessionId.."|history",
	roomName                = "rooms|"..clientRoomName,
	roomReserves            = "rooms|"..clientRoomName.."|reserves",
}

--check if room and it's properties exist on the first check
if(not checkRoomExistence(clientRoomName)) then
	return redis.error_reply('ROOM NO EXIST')
end

--check if reservationsFlag exists
if(not checkRoomSubscribeTypeReserves(clientRoomName)) then
	return redis.status_reply('NO RESERVES REQUIRED')
end

--refresh and cleanup expired reservations then return if room still exists
if(not refreshRoomReserves(clientRoomName, nodeTime)) then
	return redis.error_reply('NO RESERVATION')
end

--get session if exists
if(_tonumber(redis.call('zscore', rk.roomReserves, sessionId)) > nodeTime) then
	return redis.status_reply('HAS RESERVATION')
end

return redis.error_reply('NO RESERVATION')
