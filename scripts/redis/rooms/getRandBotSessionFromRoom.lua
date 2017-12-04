local rk = {
	roomBots            	= "rooms|"..KEYS[1].."|bots",
}
local sessionId = redis.call('srandmember', rk.roomBots)
return sessionId and sessionId or false
