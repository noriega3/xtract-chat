local _tonumber = tonumber
local sessionId = KEYS[1]
local rawSsoCheckMessage = KEYS[2]

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

ssoMessage = cjson.decode(rawSsoCheckMessage)
if(not ssoMessage) then
	return redis.error_reply('NO MESSAGE TO VERIFY')
end

if(ssoMessage.phase and ssoMessage.phase ~= "ssoCheck") then
	return redis.error_reply('INVALID PHASE')
end

newSessionId = ssoMessage.response
clientRoomName = ssoMessage.room

if(newSessionId and newSessionId == sessionId) then
	return redis.status_reply("OK")
end

local searchTerm = '[pso||is-user-id||'..sessionId..'||'
local sessions = redis.call('zrangebylex', 'hex|sessions:users', searchTerm, searchTerm..'\xff')
local subscribers = {}
local userId
--[[if(#sessions <= 0) then
	return redis.status_reply("EMPTY")
end]]

userId = sessions[1]:sub(#searchTerm)
if(not userId) then
	return redis.error_reply('INVALID USER ID')
end

searchTerm = '[ops||is-user-id||'..userId..'||'
sessions = redis.call('zrangebylex', 'hex|sessions:users', searchTerm, searchTerm..'\xff')
for x=1, #sessions do
	subscribers[x] = sessions[x]:sub(#searchTerm)
end

local dataToSend = {
	userId = userId,
	message = {
		phase = "ssoLogout",
		serverReqTime = currentTime,
		response = {
			sessionId = sessionId,
			newSessionId = newSessionId
		}
	}
}

--will return error if not existing
local sessionAlive = redis.call('zadd', rk.tickSessions, 'XX', currentTime, sessionId)

--encode message for redis
local encoded = cjson.encode(dataToSend)

--publish message
redis.call('publish', rk.roomName, encoded)

return sessionAlive and redis.status_reply('OK') or redis.error_reply('SESSION EXPIRED')
