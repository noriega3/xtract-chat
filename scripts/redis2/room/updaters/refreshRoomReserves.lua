local _tonumber = tonumber

--VALIDATION
if(not KEYS[1] or not _tostring(KEYS[1])) then return redis.error_reply('NO ROOM PATH KEY') end
if(not KEYS[2] or not _tonumber(KEYS[2])) then return redis.error_reply('NO NODE TIME KEY') end

--========================================================================
-- UTILITY Functions
--========================================================================

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

--========================================================================
-- CORE Functions
--========================================================================
local clientRoomName = KEYS[1]
local nodeTime = _tonumber(KEYS[2])
local rk = {
	roomInfo	 = 'rooms|'..KEYS[1]..'|info',
	roomReserves = 'rooms|'..KEYS[1]..'|reserves'
}

local roomReservesExists = redis.call('exists', rk.roomReserves) == 1
if(not roomReservesExists) then return redis.status_reply('EMPTY RESERVES') end

--local roomInfoExists  = redis.call('exists', rk.roomInfo) == 1
local reserveExpireTime = _tonumber(redis.call('hget', rk.roomInfo, 'reserveExpireTime')) or 5000 --todo: call db to get default

--refresh and cleanup expired reservations
local expiredReserves = redis.call('zrangebyscore', rk.roomReserves, 0, nodeTime)
for x=1, #expiredReserves do
	removeHexReserve(expiredReserves[x], 'is-reserve-of', clientRoomName)
end

redis.call('zremrangebyscore', rk.roomReserves, 0, nodeTime)
redis.call('pexpire', rk.roomReserves, reserveExpireTime)

return redis.status_reply('OK')
