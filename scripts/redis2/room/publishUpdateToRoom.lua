local _unpack = unpack
local _stringformat = string.format
local _tostring = tostring
local _tonumber = tonumber

--VALIDATION
if(not KEYS[1]) then return redis.error_reply('NO ROOM NAME KEY') end
if(not ARGV[1]) then return redis.error_reply('NO NODE TIME KEY') end
if(ARGV[2] and not cjson.decode(ARGV[2])) then return redis.error_reply('NO UPDATE DATA') end

--========================================================================
-- UTILITY Functions
--========================================================================

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

local function isValidRoomType(type)
	return type and (type == 'realtime' or type == 'turnbased' or type == 'system' or type == 'standard') --todo: add different types here or reference table
end
--========================================================================
-- CORE Functions
--========================================================================

local clientRoomName        = KEYS[1]
local nodeTime               = cjson.decode(ARGV[1])
local omitRoomData           = ARGV[2]

local rk = {
	countsOverall           = "counts|overall",
	tickRooms               = "tick|rooms",
	roomName                = "rooms|"..KEYS[1],
	roomInfo                = "rooms|"..KEYS[1].."|info",
	roomHistory             = "rooms|"..KEYS[1].."|history",
	roomMessages            = "rooms|"..KEYS[1].."|messages",
	roomBots            	= "rooms|"..KEYS[1].."|bots",
	roomReserves            = "rooms|"..KEYS[1].."|reserves",
	roomOptIns            	= "rooms|"..KEYS[1].."|optIns",
	roomMatchState          = "rooms|"..KEYS[1].."|matchState",
	roomTurnState          	= "rooms|"..KEYS[1].."|turnState"
}
local numSubscribers = 0
local sessionIds = {}
local response = {}
local roomExists, userId, roomType, roomSubscribeType, isClientBot, roomData
local isGameRoom,isTurnBased,seatKey, seat, searchTerm, searchResult, hexastore, isSystem, reservesOnly, isLobby, isOverall
local numBots

--skip system rooms
isSystem = redis.call('hexists', rk.roomInfo, 'isSystem') == 1
if(isSystem) then return redis.status_reply('SYSTEM OK') end

--check if room exists
roomExists = redis.call('exists', rk.roomInfo) == 1 and redis.call('hexists',rk.roomInfo, 'destroying') == 0
if(not roomExists) then return redis.error_reply('ROOM NO EXIST - '..clientRoomName) end

--check if room is locked
if(not redis.call('exists', rk.roomName..':locked') == 0) then return redis.error_reply('ROOM LOCKED - '..clientRoomName) end

--check roomType
roomType = redis.call('hget', rk.roomInfo, 'roomType')
if(not isValidRoomType(roomType)) then return redis.error_reply('INVALID ROOM TYPE - '..clientRoomName) end

--get session ids to room
searchTerm = '[pos||is-sub-of||'..clientRoomName..'||'
searchResult = redis.call('zrangebylex', 'hex|sessions:rooms', searchTerm, searchTerm..'\xff')
if(#searchResult <= 0) then return redis.error_reply('EMPTY ROOM - '..clientRoomName) end

for x=1, #searchResult do
	sessionIds[x] = searchResult[x]:sub(#searchTerm)
end

--get room info
--TODO: only get certain fields
roomData = redis.call('hgetall', rk.roomInfo)
local x = 1
while x <= #roomData do
	response[roomData[x]] = convertValueType(roomData[x+1])
	x = x + 2
end

isGameRoom = redis.call('hexists', rk.roomInfo, 'isGameRoom') == 1
isTurnBased = redis.call('hexists', rk.roomInfo, 'isTurnBased') == 1


isLobby = redis.call('hexists', rk.roomInfo, 'isLobby') == 1
isOverall = redis.call('hexists', rk.roomInfo, 'isOverall') == 1

--get subs
roomType = _tonumber(response.roomType)
numBots = _tonumber(response.bots)

--[[local response = {
	room 		= clientRoomName,
	botsList 	= numBots and redis.call('smembers', rk.roomBots) or {}
}]]

--if game room
if(isGameRoom) then

	--lobby overwrites all
	if(isLobby) then
		if(isOverall) then
			response.counts = redis.call('zrange', rk.countsOverall, 0,-1, 'WITHSCORES')
		else
			response.counts = redis.call('zrange', rk.countsGame, 0,-1, 'WITHSCORES')
		end
	else
		--any type of game room (except lobby)
		response.players = sessionIds

		if(isGameRoom and not isTurnBased) then
			-- only real time
		end

		if(isTurnBased) then
			local optInKey = redis.call('lindex', rk.roomOptIns, 0)
			local matchId
			-- turn based
			response.matchState 	= redis.call('lindex', rk.roomMatchState, 0)
			response.turnState 	= redis.call('lindex', rk.roomTurnState, 0)
			response.optIns 		= redis.call('lindex', rk.roomTurnState, 0)
		end
	end
else

end

local dataToSend = {
	sessionIds = sessionIds,
	messageId = -1,
	message = {
		phase = "roomUpdate",
		room = clientRoomName,
		response = response
	}
}

--overwrite or set to default some the message.response (to prevent meddling)
response.room 			= clientRoomName
response.roomType 		= roomType
response.isGameRoom 	= isGameRoom or nil
response.isTurnBased 	= isTurnBased or nil
response.isSystem 		= isSystem or nil
response.roomUpdateType = redis.call('hget', rk.roomInfo, 'roomUpdateType')

--increment message id
local nextId = redis.call('hincrby', rk.roomInfo, "nextMessageId", 1)

--add message id to ensure ordered messages by the time it reaches node
dataToSend.messageId = nextId

--send user connecting to room message list to be processed by room queue
redis.call('zadd', rk.roomMessages, nextId, cjson.encode(dataToSend.message))

--encode message and sessionId(s) for redis
local encoded = cjson.encode(dataToSend)

--https://redis.io/commands/eval#available-libraries
redis.call('publish', rk.roomName, encoded)

redis.call('zadd',rk.tickRooms,nodeTime,clientRoomName)

return redis.status_reply('UPDATE OK')

