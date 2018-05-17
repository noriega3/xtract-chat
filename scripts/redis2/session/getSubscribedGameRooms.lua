local _tonumber = tonumber
local _tostring	= tostring
local _pairs	= pairs

--VALIDATION
if(not KEYS[1]) then return redis.error_reply('NO SESSION KEY') end
if(ARGV[1] and not _tostring(ARGV[1])) then return redis.error_reply('INVALID OPTION') end

--========================================================================
-- UTILITY Functions
--========================================================================
--checks a room during a subscribe phase to ensure that this gameroom is set as the latest gameroom the user has requested to join
local hexSearchObject = function(redisKey, subject, predicate)
	local searchTerm = '[spo||'..subject..'||'..predicate..'||'
	local results = redis.call('zrangebylex', redisKey, searchTerm, searchTerm..'\xff')
	local response = {}
	for x = 1,#results do
		response[#response+1] = results[x]:sub(#searchTerm)
	end
	return response
end

--========================================================================
-- CORE Functions
--========================================================================
local sessionId             = KEYS[1]
local skipIntended			= ARGV[1] and ARGV[1] == 'SKIP INTENDED'
local rk = {
	countsRooms             = "counts|rooms",
	tickRooms               = "tick|rooms",
	tickSessions            = "tick|sessions",
	session                 = "sessions|"..sessionId
}
local lastGameRoom 	= redis.call('hget', rk.session, 'lastGameRoom')
local gameRooms 	= hexSearchObject('hex|sessions:rooms',sessionId,'has-gameroom-of')
local gameRoomList

if(not skipIntended or not lastGameRoom) then
	return gameRooms
else
	gameRoomList = {}
	for _,room in _pairs(gameRooms) do
		if(not lastGameRoom or room ~= lastGameRoom) then
			gameRoomList[#gameRoomList+1] = room
		end
	end
	return gameRoomList
end

