local _tonumber = tonumber
local rk = {
    tickRooms               = "tick|rooms",
    roomName                = "rooms|"..KEYS[1],
    roomMessages            = "rooms|"..KEYS[1].."|messages",
    roomInfo                = "rooms|"..KEYS[1].."|info",
}
local clientRoomName    = KEYS[1]
local currentTime       = _tonumber(KEYS[2])
if(not currentTime) then
	return redis.error_reply('NO SERVERTIME')
end

local message           = cjson.decode(ARGV[1]) or {}
local ignoreChecks      = ARGV[2] == 'FORCE'
local roomExists        = redis.call('exists', rk.roomInfo) == 1

if(ignoreChecks or roomExists) then --for unsubscribe, we will push the message to a user even if room is destroyed
	--do validation on all non sub/unsub publish to room commands here
	local searchTerm = '[pos||is-sub-of||'..clientRoomName..'||'
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

			local canUpdateTick = redis.call('zscore',rk.tickRooms,clientRoomName)
			canUpdateTick = canUpdateTick and _tonumber(canUpdateTick) > 0 or false --ensure that it isn't a system or standard room with tick disabled

			--add update tickers for room
			if(canUpdateTick) then
				redis.call('zadd',rk.tickRooms, 'XX', currentTime,clientRoomName)
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
		return redis.status_reply('NOT FOUND, SKIPPING '..searchTerm.." : "..tostring(searchResults[1]))
	end
end

return redis.status_reply('ROOM NOT FOUND '..KEYS[1])


