local _tonumber = tonumber
local userId = KEYS[1]
local sessionId = KEYS[2]
local appName = ARGV[1]

local rk = {
	tickSessions            = "tick|sessions",
	roomName	            = "rooms|"..sessionId,
	session                 = "sessions|"..sessionId,
	sessionSubs             = "sessions|"..sessionId.."|rooms"
}
local currentTime           = _tonumber(redis.call('get', 'serverTime'))
local ssoMessage, newSessionId, clientRoomName

if(not currentTime) then
	return redis.error_reply('NO SERVERTIME')
end

clientRoomName = userId
rk.roomName = "rooms|"..userId

if(appName) then
	clientRoomName = appName..":"..userId
	rk.roomName = clientRoomName
end

local searchTerm = '[pos||is-sub-of||'..clientRoomName..'||'
local searchResults = redis.call('zrangebylex', 'hex|sessions:rooms', searchTerm, searchTerm..'\xff')
local subscribers = {}
local subSessionId
for x=1, #searchResults do
	subSessionId = searchResults[x]:sub(#searchTerm)
	--if(subSessionId and subSessionId ~= sessionId) then
		subscribers[#subscribers+1] = subSessionId
--	end
end

local dataToSend = {
	sessionIds = subscribers,
	message = {
		phase = "ssoCheck",
		serverReqTime = currentTime,
		response = sessionId
	}
}

--will return error if not existing
local sessionAlive = redis.call('zadd', rk.tickSessions, 'XX', currentTime, sessionId)

--encode message for redis
local encoded = cjson.encode(dataToSend)

--publish message
redis.call('publish', rk.roomName, encoded)

return sessionAlive and redis.status_reply('OK') or redis.error_reply('SESSION EXPIRED')
