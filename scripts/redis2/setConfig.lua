redis.replicate_commands()
local _stringformat = string.format
local _unpack = unpack
local _tonumber = tonumber
local _tostring = tostring
local _type = type
local _pairs = pairs

--Validation
if(not ARGV[1] or not cjson.decode(ARGV[1])) then return redis.error_reply('INVALID CONFIG') end
--========================================================================
-- UTILITY Functions
--========================================================================

local setSubSettingValue = function(settingKey, subKey, subVal)
	if(_type(subVal) == 'table') then subVal = cjson.encode(subVal) end
	if(_type(subVal) ~= 'string' and _type(subVal) ~= 'number') then return end
	redis.call('hset', settingKey, subKey, subVal)
end

local setSettingValue = function(key, value)
	if(not _tostring(key)) then return false end
	local isTable = _type(value) == 'table'
	local isStrOrNum = _type(value) == 'string' or _type(value) == 'number'

	if(isTable) then
		for k,v in _pairs(value) do
			setSubSettingValue('settings:'..key, k,v)
		end
	elseif(isStrOrNum) then
		redis.call('set', 'settings:'..key, value)
	end
end

--========================================================================
-- CORE Functions
--========================================================================
local newSettings = cjson.decode(ARGV[1])
local rk = {
	settings 				= "settings:",
	settingsJson 			= "settings:_json"
}
local keys = {}

for k,v in _pairs(newSettings) do
	keys[#keys+1] = k
	setSettingValue(k,v)
end

keys[#keys+1] = 'synced'
newSettings.synced = redis.call('TIME')

newSettings = cjson.encode(newSettings)
redis.call('sadd', rk.settings, _unpack(keys))
redis.call('set', rk.settingsJson, newSettings)

return redis.status_reply(newSettings)

