local _stringformat = string.format
local _unpack = unpack
local _tonumber = tonumber

local sessionId  = KEYS[1]
local initEventId  = KEYS[2]
local currentTime = _tonumber(redis.call('get', 'serverTime'))
local sessionData = ARGV
local sessionClientRoom = "sessions:"..sessionId

local mapped = {}
local createTime = 0

local rk = {
    session 			= "sessions|"..sessionId,
    tickBots 			= "tick|bots",
    tickSessions		= "tick|sessions"
}
local rooms = {}

--- Create associations list (hexastores)
--create single hexastore
local createHexastore = function(key, subject,predicate,object)
	return redis.call('zadd', key,
		0,_stringformat("spo||%s||%s||%s",subject,predicate,object),
		0,_stringformat("sop||%s||%s||%s",subject,object,predicate),
		0,_stringformat("osp||%s||%s||%s",object,subject,predicate),
		0,_stringformat("ops||%s||%s||%s",object,predicate,subject),
		0,_stringformat("pos||%s||%s||%s",predicate,object,subject),
		0,_stringformat("pso||%s||%s||%s",predicate,subject,object))
end

--TODO: do a check for userid here

--check if session is set to destroyed
if(redis.call('hexists', rk.session, 'destroyed') == 1) then
	return redis.error_reply('no session:'..sessionId)
end

--check if session is already inited (then this is a reconnect)
if(redis.call('hexists', rk.session, 'initConfirm') == 1) then
	return redis.error_reply('SESSION EXISTS: '..sessionId)
end

for x=1, #sessionData, 2 do
    mapped[sessionData[x]] = sessionData[x+1]
end
sessionData[#sessionData+1] = 'initEventId'
sessionData[#sessionData+1] = initEventId

local isSet = redis.call('hmset', rk.session, _unpack(sessionData))

if(mapped.sessionId) then

	rooms[#rooms+1] = -1
	rooms[#rooms+1] = sessionClientRoom

	if(mapped.userId) then
		rooms[#rooms+1] = -1
		rooms[#rooms+1] = "users:"..mapped.userId
		createHexastore('hex|sessions:users', mapped.sessionId, 'is-user-id', mapped.userId)

		if(mapped.bot) then
			redis.call('zadd', 'tick|bots', createTime, mapped.sessionId)
		end
	end

	if(mapped.appName) then
		rooms[#rooms+1] = -1
		rooms[#rooms+1] = mapped.appName

		if(mapped.userId) then
			rooms[#rooms+1] = -1
			rooms[#rooms+1] = mapped.appName..":"..mapped.userId
		end
	end
end

local isTickSet = isSet and redis.call('zadd', rk.tickSessions, currentTime, sessionId)

return (isSet and isTickSet and #rooms > 0) and rooms or redis.error_reply('INIT ERROR')
