local _tonumber = tonumber

local currentTime       	= _tonumber(redis.call('get', 'serverTime'))
if(not currentTime) then
	return redis.error_reply('NO SERVERTIME')
end

local sessionId    			= KEYS[1]
local sessionRoomName 		= "sessions:"..sessionId
local message           	= cjson.decode(KEYS[2]) or {}
local ignoreChecks      	= ARGV[1] == 'FORCE'

local rk = {
	tickSessions            = "tick|sessions",
	tickRooms               = "tick|rooms",
	roomName                = "rooms|"..sessionRoomName,
	roomMessages         	= "rooms|"..sessionRoomName.."|messages",
	roomInfo                = "rooms|"..sessionRoomName.."|info",
}


local roomExists        = redis.call('exists', rk.roomInfo) == 1

if(ignoreChecks or roomExists) then --for unsubscribe, we will push the message to a user even if room is destroyed
	--do validation on all non sub/unsub publish to room commands here
	local searchTerm = '[pos||is-sub-of||'..sessionRoomName..'||'
	local searchResults = redis.call('zrangebylex', 'hex|sessions:rooms', searchTerm, searchTerm..'\xff')
	local subscribers = {}
	for x=1, #searchResults do
		subscribers[x] = searchResults[x]:sub(#searchTerm)
	end

	if(#subscribers > 0) then

		local dataToSend = {
			sessionIds = subscribers,
			message = message
		}

		if(roomExists) then

			local canUpdateTick = redis.call('zscore',rk.tickRooms,sessionRoomName)
			canUpdateTick = canUpdateTick and _tonumber(canUpdateTick) > 0 or false --ensure that it isn't a system or standard room with tick disabled

			--add update tickers for room
			if(canUpdateTick) then
				redis.call('zadd',rk.tickRooms, 'XX', currentTime,sessionRoomName)
			end

			--increase message id
			local nextId = redis.call('hincrby', rk.roomInfo, 'nextMessageId', 1)

			--add message id to ensure ordered messages by the time it reaches node
			dataToSend.messageId = nextId

			--add to list of messages
			redis.call('zadd',rk.roomMessages, nextId, cjson.encode(dataToSend.message))

		end


		local encoded = cjson.encode(dataToSend)
		return redis.call('publish', rk.roomName, encoded)
	else
		return redis.status_reply('NOT FOUND, SKIPPING '..searchTerm.."--"..tostring(searchResults[1]))
	end
end

return redis.status_reply('SESSION ROOM NOT FOUND '..sessionId)


