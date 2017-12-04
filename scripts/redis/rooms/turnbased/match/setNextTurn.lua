--Room properties
local clientRoomName 	= KEYS[1]
local currentTime       = tonumber(redis.call('get', 'serverTime'))

if(not currentTime) then
	return redis.error_reply('NO SERVERTIME')
end
local nextExpiration 	= currentTime+5000

local rk = {
	tickRooms      	= "tick|rooms",
	roomName       	= "rooms|"..KEYS[1],
	roomInfo       	= "rooms|"..KEYS[1].."|info",
	roomMessages   	= "rooms|"..KEYS[1].."|messages",
}
local doesRoomExist = redis.call('exists', rk.roomName) == 1
if(not doesRoomExist) then
	return redis.error_reply('NOT EXIST')
end

local gameInfo = redis.call('hmget', rk.roomInfo, 'gameId', 'gameState', 'nextEventId', 'turnSeatIndex', 'turnExpireAt')
local gameId = gameInfo[1]
local gameState = gameInfo[2]
local gameStateId = gameInfo[3]
local turnSeatIndex = tonumber(gameInfo[4])
local turnExpiration = tonumber(gameInfo[5])
local nextSeat

if(not gameState or gameState ~= "ACTIVE") then
	return redis.error_reply('NOT ACTIVE')
end

--update to global room ticker with a grace period of 5 seconds
redis.call('zadd',rk.tickRooms,currentTime+5000,clientRoomName)

local function isSeatActive(seatIndex)
	if(seatIndex == 5) then return true end
	local isSessionAlive = isSeatTaken and ((redis.call('zscore', 'tick|sessions', isSeatTaken)+60000) > currentTime) --5 sec grace
	return isSeatTaken and isSessionAlive
end

local function getNextSeat()
	if(nextSeat == 5) then return 5 end
	nextSeat = redis.call('hincrby', rk.roomInfo, 'turnSeatIndex', 1)
	if(not nextSeat) then return false end
	if(not isSeatActive(nextSeat)) then return getNextSeat() end
	return nextSeat
end

nextSeat = getNextSeat()
if(not nextSeat) then return redis.error_reply("GAME NOT ACTIVE") end

--dealer turn
if(not nextSeat and nextSeat > numSeats) then
	redis.call('hset', rk.roomInfo, 'gameState', 'COMPLETE')
	redis.call('hincrby', rk.roomInfo, 'gamesCompleted', 1)
	nextExpiration = currentTime+10000
end

redis.call('hset', rk.roomInfo, 'turnExpireAt', nextExpiration)

local publishTurn = function()
	local dataToSend = {
		sessionIds = nil,
		message = {
			phase = "roomUpdate",
			room = clientRoomName,
			response = {
				--overwite or set to default some the message.response (to prevent meddling)
				room = clientRoomName,
				gameId = gameId,
				gameState = gameState,
				prevSeatIndex = turnSeatIndex,
				turnSeatIndex = nextSeat,
				turnExpiration = nextExpiration
			}
		}
	}
	local sessionIds = {}
	local searchTerm = '[pos||is-sub-of||'..clientRoomName..'||'
	local subscribers = redis.call('zrangebylex', 'hex|sessions:rooms', searchTerm, searchTerm..'\xff')

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
end

publishTurn()

return redis.status_reply('OK')
