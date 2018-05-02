local _stringformat = string.format
local _tonumber = tonumber
local _unpack = unpack
local _tostring = tostring
local _type = type

--Validations
if(not KEYS[1] or not _tostring(KEYS[1])) then return redis.error_reply('NO ROOM NAME KEY') end
if(_tonumber(KEYS[2])) then return redis.error_reply('NO NODE TIME KEY') end

--========================================================================
-- UTILITY Functions
--========================================================================
local updateCount = function(path, newCount, member)
	if(not path or _type(newCount) ~= 'number' or _type(member) ~= 'string') then return false end
	return redis.call('zadd', 'counts|'..path, newCount, member)
end

local convertValueType = function(value)
	local newVal, isNumeric, isString
	isNumeric = _tonumber(value)
	if(isNumeric) then
		return isNumeric
	else
		isString = _tostring(value)
		if(not isString) then
			return nil
		elseif(isString == 'true' or isString == 'false') then
			return isString == 'true'
		else
			return isString
		end
	end
end
--========================================================================
-- CORE Functions
--========================================================================

local clientRoomName	= KEYS[1]
local rk = {
	countsRooms = 'counts|rooms',
	openRooms 	= 'open|rooms',
	roomName 	= 'rooms|'..KEYS[1],
	roomInfo 	= 'rooms|'..KEYS[1]..'|info'
}

if(redis.call('exists', rk.roomInfo) == 0) then return redis.error_reply('ROOM NO EXIST') end

local countKeys = {'destroying', 'roomSubscribeType', 'maxSubscribers', 'roomName','roomPath','roomAppName','roomGame','roomTheme','roomId','roomAppGameName','roomAppGameThemeName','roomGameThemeName'}
local roomInfo = redis.call('hmget', rk.roomInfo, _unpack(countKeys))
local roomData = {}
local isNumeric, isBoolean, value
if(not roomInfo) then return redis.error_reply('NO ROOM DATA') end

for x=1, #roomInfo do
	roomData[countKeys[x]] = convertValueType(roomInfo[x])
end

if(roomData['destroying']) then return redis.error_reply('ROOM DESTROY STATE'.._type(roomData['destroying'])) end

local subCount 				= _tonumber(redis.call('zlexcount', 'hex|sessions:rooms', '[pos||is-sub-of||'..clientRoomName..'||', '[pos||is-sub-of||'..clientRoomName..'||\xff')) or 0
local openCount 			= _tonumber(roomData['maxSubscribers']) - subCount
if(not roomData['roomName']) then return redis.error_reply('NO ROOM NAME') end

if(subCount == 0) then
	redis.call('zrem', rk.countsRooms, clientRoomName)
else
	redis.call('zadd', rk.countsRooms, subCount, clientRoomName)
end

if(openCount > 0) then
	--we make a range between <= 2 'high' and 'low' > 2 so rooms with less than 2 spots get filled first
	--todo: consolidation of 'low' rooms when it gets to a high enough # to gracefully combine rooms (and also don't count bots)
	if(openCount <= 2) then
		redis.call('zrem', rk.openRooms, 'low::'..clientRoomName)
		redis.call('zadd', rk.openRooms, 0, 'high::'..clientRoomName)
	else
		redis.call('zrem', rk.openRooms, 'high::'..clientRoomName)
		redis.call('zadd', rk.openRooms, 0, 'low::'..clientRoomName)
	end
else
	redis.call('zrem', rk.openRooms, 'high::'..clientRoomName, 'low::'..clientRoomName)
end

--if reservation flag true
local roomReserveOnly = roomData['roomSubscribeType'] == 'reserves'
if(roomReserveOnly) then
	local reserveCount = _tonumber(redis.call('zlexcount', 'hex|sessions:rooms', '[pos||is-reserve-of||'..clientRoomName..'||', '[pos||is-reserve-of||'..clientRoomName..'||\xff'))
	local openCountWithReserves = _tonumber(roomData['maxSubscribers']) - (subCount + reserveCount)

	if(openCountWithReserves > 0) then
		--we make a range between <= 2 'high' and 'low' > 2 so rooms with less than 2 spots get filled first
		--todo: consolidation of 'low' rooms when it gets to a high enough # to gracefully combine rooms (and also don't count bots)
		if(openCountWithReserves <= 2) then
			redis.call('zrem', rk.openRooms, 'rlow::'..clientRoomName)
			redis.call('zadd', rk.openRooms, 0, 'rhigh::'..clientRoomName)
		else
			redis.call('zrem', rk.openRooms, 'rhigh::'..clientRoomName)
			redis.call('zadd', rk.openRooms, 0, 'rlow::'..clientRoomName)
		end
	else
		redis.call('zrem', rk.openRooms, 'rhigh::'..clientRoomName, 'rlow::'..clientRoomName)
	end
end


--GAME ROOM SPECIFIC
if(roomData['roomPath'] and roomData['roomPath'] ~= clientRoomName) then
	rk.countsRoomPath = 'counts|'..roomData['roomPath']
	redis.call('zadd',rk.countsRoomPath, subCount, clientRoomName)
end

if(roomData['roomTheme'] and roomData['appGameThemeName'] and roomData['roomAppGameName']) then
	if(roomData['roomAppGameName'] ~= clientRoomName) then
		rk.countsAppGameName = 'counts|'..roomData['roomAppGameName']
		local themeCount = redis.call('zlexcount', 'hex|sessions:rooms', '[pos||is-sub-of||'..roomData['appGameThemeName']..':', '[pos||is-sub-of||'..roomData['appGameThemeName']..':\xff')
		redis.call('zadd', rk.countsAppGameName, themeCount, roomData['roomTheme'])
	end
end

if(roomData['roomGame'] and roomData['roomAppGameName'] and roomData['roomAppGameThemeName']) then
	if(roomData['roomAppGameThemeName'] ~= clientRoomName) then
		rk.countsAppGameThemeName = 'counts|'..roomData['roomAppGameThemeName']
		local gameCount = redis.call('zlexcount', 'hex|sessions:rooms', '[pos||is-sub-of||'..roomData['roomAppGameName']..':', '[pos||is-sub-of||'..roomData['roomAppGameName']..':\xff')
		redis.call('zadd', rk.countsAppGameThemeName, gameCount, roomData['roomGame'])
	end
end
