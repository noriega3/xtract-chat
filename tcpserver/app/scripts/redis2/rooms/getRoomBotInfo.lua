local _tonumber			= tonumber
local _tostring			= tostring
local _unpack			= unpack

local clientRoomName 	= KEYS[1]
local currentTime       = _tonumber(redis.call('get', 'serverTime'))
if(not currentTime) then
	return redis.error_reply('NO SERVERTIME')
end
local rk = {
	roomInfo       		= "rooms|"..KEYS[1].."|info",
	roomBots 	  		= "rooms|"..KEYS[1].."|bots",
}
local doesRoomExist
local botData = {}
local roomBots = {}
local roomBotInfo, isNumeric, dbgWarning

doesRoomExist = redis.call('exists', rk.roomInfo) == 1
if(not doesRoomExist) then
	return redis.error_reply('NOT EXIST')
end
local infoKeys = {'roomName','bots','maxBots', 'maxSubscribers', 'subscribers'}
roomBotInfo = redis.call('hmget', rk.roomInfo, _unpack(infoKeys))
for x=1, #roomBotInfo do
	isNumeric = _tonumber(roomBotInfo[x])
	botData[infoKeys[x]] = isNumeric and isNumeric or _tostring(roomBotInfo[x])
end

--double check maxBots to maxSubscribers to ensure at least one space open when maxBots => maxSubscribers
if(botData and botData.maxBots and botData.maxSubscribers and botData.maxSubscribers <= botData.maxBots and botData.maxSubscribers > 0) then
	--needs to be at least one open spot for a normal user to enter
	dbgWarning = "["..clientRoomName.."] maxBots decreased from "..botData.maxBots.. " to "..botData.maxSubscribers-1
	botData.maxBots = botData.maxSubscribers-1
elseif((botData.subscribers - botData.bots) <= 0) then
	botData.maxBots = 0
end

roomBots = redis.call('smembers', rk.roomBots)

return cjson.encode({
	roomName = clientRoomName,
	botData = botData,
	bots = roomBots,
	dbgWarning = dbgWarning
})



