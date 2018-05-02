local _unpack = unpack
local _stringformat = string.format
local _tonumber = tonumber

local clientRoomName        = KEYS[1]
local roomArr               = cjson.decode(KEYS[2])
local currentTime           = _tonumber(redis.call('get', 'serverTime'))
local omitRoomData           = ARGV[1]

if(not currentTime) then
	return redis.error_reply('NO SERVERTIME')
end
local numSubscribers        = 0

local rk = {
	countsOverall           = "counts|overall",
	countsRooms             = "counts|rooms",
	countsRoomPath          = "counts|"..roomArr['roomPath'],
	countsGame              = "counts|"..roomArr['roomAppGameName'],
	countsGameTheme         = "counts|"..roomArr['roomAppGameThemeName'],
	tickRooms               = "tick|rooms",
	tickSessions            = "tick|sessions",
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
local roomExists            = redis.call('exists', rk.roomInfo) == 1
if(not roomExists) then
	return redis.error_reply('NO EXIST - '..clientRoomName)
end

local updateCounts = function()
	local subCount = redis.call('zlexcount', 'hex|sessions:rooms', '[pos||is-sub-of||'..clientRoomName..'||', '[pos||is-sub-of||'..clientRoomName..'||\xff')
	local themeCount = redis.call('zlexcount', 'hex|sessions:rooms', '[pos||is-sub-of||'..roomArr['roomAppGameThemeName']..':', '[pos||is-sub-of||'..roomArr['roomAppGameThemeName']..':\xff')
	redis.call('zadd', rk.countsRooms, subCount, clientRoomName)
	redis.call('zadd', rk.countsRoomPath, subCount, clientRoomName)
	redis.call('zadd', rk.countsGame, themeCount, roomArr['roomTheme'])
	return true
end
updateCounts()

--get room info
local info = redis.call('hgetall', rk.roomInfo)
if(info.room ~= clientRoomName) then
	return redis.error_reply('REQUESTED ROOM DOES NOT MATCH')
end

--get subs
local sessionIds = {}
local searchTerm = '[pos||is-sub-of||'..clientRoomName..'||'
local subscribers = redis.call('zrangebylex', 'hex|sessions:rooms', searchTerm, searchTerm..'\xff')
for x=1, #subscribers do
	sessionIds[x] = subscribers[x]:sub(#searchTerm)

	if(sessionIds[x]) then
		sessionIds[x] = redis.call('hgetall', 'sessions|'..sessionIds[x])
	end
end

if(#sessionIds <= 0) then
	return redis.error_reply('NO SESSIONS')
end

local roomType = _tonumber(info.roomType)
local numBots = _tonumber(info.bots)
if(not roomType and type(roomType) ~= 'number') then return false end
local isGameRoom = roomType >= -1 and roomType == 1 or roomType == 2
local isRealTime = isGameRoom and roomType == 1
local isTurnBased = isGameRoom and roomType == 2
local isOverall = isGameRoom and roomArr[2] and roomArr[2] == "overall"
local isLobby = isGameRoom and roomArr[3] and roomArr[3] == "lobby"

local response = {
	room 		= clientRoomName,
	botsList 	= numBots and redis.call('smembers', rk.roomBots) or {}
}

--add to info object

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
		response.roomData = omitRoomData and nil or info

		if(isRealTime) then
			-- only real time
		end

		if(isTurnBased) then
			local optInKey = redis.call('lindex', rk.roomOptIns, 0)
			local matchId
			-- turn based
			response.matchState 	= redis.call('lindex', rk.roomMatchState, 0)
			response.turnState 	= redis.call('lindex', rk.roomTurnState, 0)
			response.optIns 		= redis.call('lindex', rk.roomTurnState, 0)
			roomOptIns	            = "rooms|"..KEYS[1].."|optIns"
			roomMatchState          = "rooms|"..KEYS[1].."|matchState"
			roomTurnState          	= "rooms|"..KEYS[1].."|turnState"
		end
	end
end


local dataToSend = {
	sessionIds = nil,
	messageId = -1,
	message = {
		phase = "roomUpdate",
		room = clientRoomName,
		response = response
	}
}

--set dataToSend.sessionIds
--store count of subs
numSubscribers = #subscribers

for x=1, #subscribers do
	sessionIds[x] = subscribers[x]:sub(#searchTerm)
end

--set sessionIds to list of ids in the room
dataToSend.sessionIds = sessionIds

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

--return the sub message to retry if failure
return cjson.encode(dataToSend.message)
