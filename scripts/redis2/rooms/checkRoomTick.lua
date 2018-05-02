local _tonumber = tonumber

local clientRoomName        = KEYS[1]
local currentTime           = _tonumber(redis.call('get', 'serverTime'))
if(not currentTime) then
	return redis.error_reply('NO SERVERTIME')
end

local rk = {
    tickRooms            = "tick|rooms",
    roomName             = "rooms|"..KEYS[1],
    roomInfo             = "rooms|"..KEYS[1].."|info"
}

--skip updating rooms who have a 0 in their tick value
if(_tonumber(redis.call('zscore', rk.tickRooms, clientRoomName)) > 0) then
	--update room tick or return error when return changed number is 0
	if(redis.call('zadd', rk.tickRooms, 'XX', 'CH', 'INCR', currentTime, clientRoomName) == 0) then
		return redis.error_reply('INVALID ROOM TICK')
	end
end

return redis.call('exists', rk.roomName) and redis.call('exists', rk.roomInfo)
