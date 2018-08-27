local _stringformat = string.format
local _unpack = unpack
local _tonumber = tonumber
local _type = type
local _len = string.len
local _insert = table.insert
local _sub = string.sub
local _find = string.find

--========================================================================
-- UTILITY Functions
--========================================================================
local split = function(s, p)
	local temp = {}
	local index = 0
	local last_index = _len(s)

	while true do
		local i, e = _find(s, p, index)

		if i and e then
			local next_index = e + 1
			local word_bound = i - 1
			_insert(temp, _sub(s, index, word_bound))
			index = next_index
		else
			if index > 0 and index <= last_index then
				_insert(temp, _sub(s, index, last_index))
			elseif index == 0 then
				temp = nil
			end
			break
		end
	end

	return temp
end

local getSetting = function(key)
	local settingKey = 'settings:'..key
	local tbl

	if(redis.call('sismember', 'settings:', key) == 1) then
		local valType = redis.call('type', settingKey)
		if(valType == 'string') then
			return redis.call('get', settingKey)
		elseif(valType == 'list') then
			return redis.call('lrange', settingKey, 0, 100) --limit to 100 just in case TODO
		elseif(valType == 'set') then
			return redis.call('smembers', settingKey)
		elseif(valType == 'zset') then
			return redis.call('zrange', settingKey, 0, 100)
		elseif(valType == 'hash') then
			return redis.call('hgetall', settingKey)
		end
		return redis.call('get', settingKey)
	end

	tbl = split(key,'.')

	if(not tbl or not tbl[1] or tbl[1] <= 0) then return nil end
	settingKey = tbl[1]
	if(redis.call('exists', settingKey) == 0) then return nil end


--[[	for x=2, #tbl do
		if(tbl[x] and #tbl[x] > 0 and redis.call('hexists', settingKey, tbl[x])) then
			return redis.call('hget', settingKey, tbl[x])
		end
	end]]
	return nil
end
--========================================================================
-- CORE Functions
--========================================================================
local rk = {
	settings 				= "settings:",
	settingsJson 			= "settings:_json", --json object
	settingsMaintenanceMode = "settings:_maintenanceMode"
}
local storedSettings = {}

if(ARGV) then
	for x=1, #ARGV do
		if(_type(ARGV[x]) == 'string') then
			storedSettings[ARGV[x]] = getSetting(ARGV[x])
		end
	end
	storedSettings = cjson.encode(storedSettings)
else
	storedSettings = redis.call('get', rk.settingsJson)
end

return storedSettings
