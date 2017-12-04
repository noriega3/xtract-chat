local _tonumber			= tonumber

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
local optIns = {}
local doesRoomExist
local matchInfo
local matchId, nextMatchId, turnStart,turnExpiration, matchState, optInsResult,turnSeatIndex
local optInSeatIndex, optInSessionId

doesRoomExist = redis.call('exists', rk.roomName) == 1
if(not doesRoomExist) then
	return redis.error_reply('NOT EXIST')
end
--[[--TODO: fix
local gameInfo = redis.call('hmget', rk.roomInfo, 'matchId', 'nextEventId', 'turnSeatIndex', 'turnExpireAt')
local gameId = gameInfo[1]
local gameState = redis.call('lindex', rk.roomMatchState, 0)
local gameStateId = gameInfo[2]
local turnSeatIndex = tonumber(gameInfo[3])
local turnExpiration = tonumber(gameInfo[4])

if(not gameState) then
	return redis.error_reply('NOT ACTIVE')
end]]

rk.roomOptInsMatch = redis.call('lindex', rk.roomOptIns, 0)
rk.roomOptInsMatchLocked = rk.roomOptInsMatch..":locked"

matchState 		= redis.call('lindex', rk.roomMatchState, 0)
matchInfo 		= redis.call('hmget', rk.roomInfo, 'matchId', 'nextMatchId', 'turnStartAt', 'turnExpireAt')
matchId 		= _tonumber(matchInfo[1])
nextMatchId		= _tonumber(matchInfo[2])
turnStart 		= _tonumber(matchInfo[3])
turnExpiration 	= _tonumber(matchInfo[4])
optInsResult	= matchState == "ACTIVE" and redis.call('hgetall', rk.roomOptInsMatchLocked) or redis.call('hgetall', rk.roomOptInsMatch)
turnSeatIndex 	= redis.call('exists', rk.roomTurnState) == 1 and _tonumber(redis.call('lindex', rk.roomTurnState, 0)) or -1


--format optIns
if(#optInsResult > 0) then
	for x=1, #optInsResult, 2 do
		optInSeatIndex = _tonumber(optInsResult[x])
		optInSessionId = optInsResult[x+1]

		optIns[#optIns+1] = {
			optIn = true,
			seat = optInSeatIndex,
			sessionId = optInSessionId
		}
	end
end
--[[local debugIns = {}
if(matchState == "OPT_IN") then

	--check if room has seats and optIns key has values
	local optInSeats, seat, session
	local numOptIns = redis.call('hlen', rk.roomOptInsMatch)
	local seats = redis.call('zrangebylex', rk.roomName, '[taken:seat:', '[taken:seat:\xff')
	if(not seats or #seats <= 0) then
		return redis.error_reply('INVALID ROOM')
	end

	--update global room ticker to keep room alive
	redis.call('zadd',rk.tickRooms,currentTime+5000,clientRoomName)

	--check if we can change to active state
	if(numOptIns and numOptIns > 0) then
		optInSeats = redis.call('hvals', rk.roomOptInsMatch)

		--reuse
		numOptIns = 0

		--===================================================
		function string:split(sep)
			local sep, fields = sep or ":", {}
			local pattern = string.format("([^%s]+)", sep)
			self:gsub(pattern, function(c) fields[#fields+1] = c end)
			return fields
		end

		local function validateSession(sid)
			local isValid = false
			for o=1, #optInSeats do
				--TODO: add a check against hexastore is-sub-of
				if(optInSeats[o]==sid) then
					isValid = true
				end
			end
			return isValid
		end

		local function validateSeat(seat, session)
		end
		--===================================================

		--add a -1 to first turnState signify start of match

		--loop through optIn db, check if each user opted in is valid
		for x=1, #seats do
			local data = seats[x]:gsub("taken:seat:", ""):split(":")
			seat, session = data[1], data[2]
			local matchSession = seat and redis.call('hget', rk.roomOptInsMatch, seat) or false
			local isOptIn = matchSession and matchSession == session

			debugIns[#debugIns+1] = {
				optIn 		= isOptIn,
				seat 		= x,
				sessionId 	= session,
				dbgseat 	= seat
			}

			if(isOptIn) then
				numOptIns = numOptIns+1
			end
		end

	end

end]]
local publishTurn = function()
	local dataToSend = {
		sessionIds = nil,
		message = {
			phase = "roomUpdate",
			room = clientRoomName,
			response = {
				room 			= clientRoomName,
				matchId 		= matchId,
				gameId 			= matchId, --todo:remove
				nextMatchId 	= nextMatchId,
				matchState 		= matchState,
				gameState 		= matchState, --todo:remove
				optIns 			= optIns,
				turnSeatIndex 	= turnSeatIndex,
				turnStartTime 	= turnStart,
				turnExpiration 	= turnExpiration, --debug 	= debugIns
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
	dataToSend.message.response.messageId = nextId

	--send user connecting to room message list to be processed by room queue
	redis.call('zadd', rk.roomMessages, nextId, cjson.encode(dataToSend.message))

	--encode message and sessionId(s) for redis
	local encoded = cjson.encode(dataToSend)

	--https://redis.io/commands/eval#available-libraries
	redis.call('publish', rk.roomName, encoded)

	--return the sub message to retry if failure
	return cjson.encode(dataToSend.message)
end

return publishTurn()



