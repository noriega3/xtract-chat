--Room properties
local clientRoomName 	= KEYS[1]
local currentTime           = redis.call('get', 'serverTime')

if(not currentTime) then
	return redis.error_reply('NO SERVERTIME')
end
local newGameState 		= 'ACTIVE'
local turnExpiration 	= currentTime+5000

local rk = {
	tickRooms      	= "tick|rooms",
	roomName       	= "rooms|"..KEYS[1],
	roomInfo       	= "rooms|"..KEYS[1].."|info",
	roomMessages   	= "rooms|"..KEYS[1].."|messages",
	roomOptIns   	= "rooms|"..KEYS[1].."|optIns",
	roomPlayers   	= "rooms|"..KEYS[1].."|players",
}
local doesRoomExist = redis.call('exists', rk.roomName) == 1

if(not doesRoomExist) then
	return redis.error_reply('NOT EXIST')
end

local prevGameState = redis.call('hget', rk.roomInfo, 'gameState') or 'CREATED'

--update to global room ticker with a grace period of 5 seconds
redis.call('zadd',rk.tickRooms,currentTime+5000,clientRoomName)

--add room info
redis.call('hmset', rk.roomInfo,
	'gameState', newGameState,
	'turnSeatIndex', 1,
	'turnExpireAt', turnExpiration
)

local newGameId = redis.call('hincrby', rk.roomInfo, 'gameId', 1) --increase
local gameId = newGameId - 1
local gameStateId = redis.call('hincrby', rk.roomInfo, "nextEventId", 1)



local publishSubscribe = function()
	local dataToSend = {
		sessionIds = nil,
		message = {
			phase = "roomUpdate",
			room = clientRoomName,
			response = {
				--overwite or set to default some the message.response (to prevent meddling)
				room = clientRoomName,
				gameId = gameId..":"..gameStateId,
				prevGameState = prevGameState,
				gameState = newGameState,
				turnStart = 1, --TODO: add in check for opt in to non opted or empty seats
				turnExpiration = 5000
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

	--encode message and sessionId(s) for redis
	local encoded = cjson.encode(dataToSend)

	--increment message id
	local nextId = redis.call('hincrby', rk.roomInfo, "nextMessageId", 1)

	--send user connecting to room message list to be processed by room queue
	redis.call('zadd', rk.roomMessages, nextId, cjson.encode(dataToSend.message))

	--https://redis.io/commands/eval#available-libraries
	redis.call('publish', rk.roomName, encoded)

	--return the sub message to retry if failure
	return cjson.encode(dataToSend.message)
end

local roomGameOptInKey 	= rk.roomOptIns..":"..gameId
if(redis.call('exists',roomGameOptInKey) == 1) then
	--rename the optIns to the currentGame
	local roomGameKey 		= rk.roomPlayers..":"..gameId
	redis.call('sadd', 'games|turnBased', roomGameKey)
	redis.call('rename', roomGameOptInKey, roomGameKey)
	publishSubscribe()

end



return redis.status_reply('OK')
