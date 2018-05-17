local sessionId             = KEYS[1]

local hexSearchObject = function(redisKey, predicate, subject)
	local searchTerm = '[pso||'..predicate..'||'..subject..'||'
	local results = redis.call('zrangebylex', redisKey, searchTerm, searchTerm..'\xff')
	local response = {}
	for x = 1,#results do
		response[#response+1] = results[x]:sub(#searchTerm)
	end
	return response
end

return hexSearchObject('hex|sessions:rooms', 'has-gameroom-of', sessionId)
