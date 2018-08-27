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
	roomMatchList   	= "rooms|"..KEYS[1].."|match",
}
local doesRoomExist
local optInSeatIndex, optInSessionId, optInsResultActive
local optIns = {}
local matchId, nextMatchId, turnStart,turnExpiration, matchState, optInsResult,matchTurn
local roomData = {}
local matchData = {}
local response, roomInfo, matchInfo
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
infoKeys = {'matchId', 'matchHash', 'matchMessageIdStart', 'matchTimeStart','matchTurnStart', 'matchTurnExpire', 'prevMatchId', 'prevMatchTimeStart', 'prevMatchTimeEnd', 'prevMessageIdStart', 'prevMessageIdEnd', 'nextMatchId', 'nextMatchHash'}
matchInfo = redis.call('hmget', rk.roomInfo, _unpack(infoKeys))
for x=1, #matchInfo do
	isNumeric = _tonumber(matchInfo[x])
	matchData[infoKeys[x]] = isNumeric and isNumeric or _tostring(matchInfo[x])
end

--[[matchId 		= roomData.matchId,
nextMatchId 	= roomData.nextMatchId,
matchState 		= matchState,
matchHash 		= roomData.matchHash,
matchProps 		= cjson.decode(roomData.matchProps),
optIns 			= optIns,
turnSeatIndex 	= turnSeatIndex,
turnStartTime 	= roomData.turnStartAt,
turnExpiration 	= roomData.turnExpireAt]]

matchId = _tonumber(redis.call('lindex', rk.roomMatchList, 0))
if(not matchId) then
	return redis.error_reply('INVALID MATCH')
end

rk.roomMatch = rk.roomMatchList..":"..matchId
rk.roomMatchLive = rk.roomMatch..":live"
rk.roomMatchTurn = rk.roomMatch..":turn"
rk.roomMatchState = rk.roomMatch..":state"

matchState 			= redis.call('lindex', rk.roomMatchState, 0)
optInsResult		= redis.call('hgetall', rk.roomMatch)
optInsResultActive	= redis.call('hgetall', rk.roomMatchLive)
matchTurn 			= redis.call('exists', rk.roomMatchTurn) == 1 and _tonumber(redis.call('lindex', rk.roomMatchTurn, 0)) or 0

--format optIns
local function updateOptInTable(key, data)
	if(not data or #data <= 0) then return end
	local optInSeatData
	local formatted
	for x=1, #data, 2 do
		optInSeatData = data[x+1]
		formatted = not formatted and {} or formatted
		formatted[#formatted+1] = cjson.decode(optInSeatData)
	end

	--{{match# = { { seat 1 data, seat 2 data, .. }, match# = { {seat 1 data, seat 2 data, .. }}
	optIns[_tonumber(key)] = formatted
end

updateOptInTable(matchData.matchId, optInsResultActive)
updateOptInTable(matchData.nextMatchId, optInsResult)

if(matchState == "ACTIVE") then
	updateOptInTable(matchData.matchId, optInsResultActive)
	updateOptInTable(matchData.nextMatchId, optInsResult)
else
	updateOptInTable(matchData.matchId, optInsResult)
end

local publishTurn = function()

	matchData.matchState = matchState
	matchData.matchTurn = matchTurn
	matchData.optIns = optIns

	local sessionIds, playerData = {}, {}
	local dataToSend = {
		sessionIds = nil,
		message = {
			phase = "roomUpdate",
			room = clientRoomName,
			response = {
				room 			= clientRoomName,
				roomHash 		= roomData.roomHash,
				roomData 		= roomData,
				matchData 		= matchData,
				players 		= playerData
			}
		}
	}
	local seatSearchTerm = '[taken:session:'
	local searchTerm = '[pos||is-sub-of||'..clientRoomName..'||'
	local subscribers = redis.call('zrangebylex', 'hex|sessions:rooms', searchTerm, searchTerm..'\xff')
	local roomSeats = redis.call('zrangebylex',rk.roomName, seatSearchTerm, seatSearchTerm..'\xff')
	local pdata = {}
	local seatData = {}

	if(roomSeats) then

		local function split(str)
			local fields = {}
			local pattern = string.format("([^%s]+)", ":")
			str:gsub(pattern, function(c) fields[#fields+1] = c end)
			return fields
		end

		for x=1, #roomSeats do
			pdata = roomSeats[x]:sub(#seatSearchTerm)
			pdata = pdata and split(pdata)
			if(pdata and #pdata == 2) then
				seatData[pdata[1]] = _tonumber(pdata[2])
			end
		end
	end


	for x=1, #subscribers do
		sessionIds[x] = subscribers[x]:sub(#searchTerm)
		if(sessionIds[x] and redis.call('exists', 'sessions|'..sessionIds[x]) == 1) then
			pdata = redis.call('hgetall', 'sessions|'..sessionIds[x])
			playerData[x] = {
				seatIndex = seatData[sessionIds[x]]
			}
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



