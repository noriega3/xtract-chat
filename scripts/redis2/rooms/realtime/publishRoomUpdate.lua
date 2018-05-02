local _tonumber			= tonumber
local _tostring			= tostring
local _unpack			= unpack

local clientRoomName 	= KEYS[1]
local currentTime       = _tonumber(redis.call('get', 'serverTime'))
if(not currentTime) then
	return redis.error_reply('NO SERVERTIME')
end
local rk = {
	tickRooms      		= "tick|rooms",
	roomName       		= "rooms|"..KEYS[1],
	roomInfo       		= "rooms|"..KEYS[1].."|info",
	roomOptIns  		= "rooms|"..KEYS[1].."|optIns",
	roomMessages   		= "rooms|"..KEYS[1].."|messages",
	roomMatchState   	= "rooms|"..KEYS[1].."|matchState",
	roomTurnState   	= "rooms|"..KEYS[1].."|turnState",
}
local doesRoomExist
local optInSeatIndex, optInSessionId

local response, roomInfo
local roomData = {}
local isNumeric

doesRoomExist = redis.call('exists', rk.roomInfo) == 1
if(not doesRoomExist) then
	return redis.error_reply('NOT EXIST')
end

local infoKeys = {'roomName','roomPath','roomType','roomTypeId','subscribers','updated','created','bots','nextMessageId','maxSubscribers','subscribers','observers','maxObservers', 'roomHash'}
roomInfo = redis.call('hmget', rk.roomInfo, _unpack(infoKeys))
for x=1, #roomInfo do
	isNumeric = _tonumber(roomInfo[x])
	roomData[infoKeys[x]] = isNumeric and isNumeric or _tostring(roomInfo[x])
end

local publishTurn = function()
	local sessionIds, playerData = {}, {}
	local dataToSend = {
		sessionIds = nil,
		message = {
			phase = "roomUpdate",
			room = clientRoomName,
			response = {
				room = clientRoomName,
				roomHash = roomData.roomHash,
				roomData = roomData,
				players = playerData
			}
		}
	}
	local searchTerm = '[pos||is-sub-of||'..clientRoomName..'||'
	local subscribers = redis.call('zrangebylex', 'hex|sessions:rooms', searchTerm, searchTerm..'\xff')
	local pdata = {}

	for x=1, #subscribers do
		sessionIds[x] = subscribers[x]:sub(#searchTerm)
		if(sessionIds[x] and redis.call('exists', 'sessions|'..sessionIds[x]) == 1) then
			pdata = redis.call('hgetall', 'sessions|'..sessionIds[x])
			playerData[x] = {}

			for p=1, #pdata, 2 do
				playerData[x][pdata[p]] = pdata[p+1]
			end
		end
	end

	--set sessionIds to list of ids in the room
	dataToSend.sessionIds = sessionIds

	--append message with player data
	dataToSend.message.response.players = playerData

	--increment message id
	local nextId = redis.call('hincrby', rk.roomInfo, "nextMessageId", 1)

	--add message id to ensure ordered messages by the time it reaches node
	dataToSend.messageId = nextId
	dataToSend.message.response.messageId = nextId

	local message = cjson.encode(dataToSend.message)

	--send user connecting to room message list to be processed by room queue
	redis.call('zadd', rk.roomMessages, nextId, message)

	--encode message and sessionId(s) for redis
	local encoded = cjson.encode(dataToSend)

	--https://redis.io/commands/eval#available-libraries
	redis.call('publish', rk.roomName, encoded)

	--return the sub message to retry if failure
	return message
end

return publishTurn()



