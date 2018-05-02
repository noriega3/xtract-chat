local _stringformat = string.format
local _tonumber = tonumber

--removes the hex reservation
local function removeHexReserve(subject,object)
	return redis.call('zrem', 'hex|sessions:rooms',
	_stringformat("sop||%s||%s||%s", subject, object, 'is-reserve-of'),
	_stringformat("spo||%s||%s||%s", subject, 'is-reserve-of', object),
	_stringformat("ops||%s||%s||%s", object, 'is-reserve-of', subject),
	_stringformat("osp||%s||%s||%s", object, subject, 'is-reserve-of'),
	_stringformat("pso||%s||%s||%s", 'is-reserve-of', subject, object),
	_stringformat("pos||%s||%s||%s", 'is-reserve-of', object, subject))
end

local sessionId             = KEYS[1]
local clientRoomName        = KEYS[2]
local currentTime           = _tonumber(redis.call('get', 'serverTime'))
if(not currentTime) then
	return redis.error_reply('NO SERVERTIME')
end

local rk = {
	countsRooms             = "counts|rooms",
	tickRooms               = "tick|rooms",
	tickSessions            = "tick|sessions",
	session                 = "sessions|"..KEYS[1],
	sessionSubs             = "sessions|"..KEYS[1].."|rooms",
	sessionHistory          = "sessions|"..KEYS[1].."|history",
	roomName                = "rooms|"..KEYS[2],
	roomReserves            = "rooms|"..KEYS[2].."|reserves",
}
local roomExists            = redis.call('exists', rk.roomReserves) == 1

--refresh and cleanup expired reservations
local expiredReserves = redis.call('zrangebyscore', rk.roomReserves, 0, currentTime)
local sessionExpirationTime

if(#expiredReserves > 0) then
	for x=1, #expiredReserves do
		removeHexReserve(expiredReserves[x],clientRoomName)
	end
	redis.call('zremrangebyscore', rk.roomReserves, 0, currentTime)
end

--check if reservation table still exists after cleanup
if(not roomExists) then
	return redis.error_reply('NO RESERVATION')
end

--check if reservation for session exists
sessionExpirationTime = _tonumber(redis.call('zscore', rk.roomReserves, sessionId))
if(not sessionExpirationTime) then
	return redis.error_reply('NO RESERVATION')
end
if(currentTime > sessionExpirationTime) then
	return redis.status_reply('EXPIRED')
end

return redis.status_reply('OK')
