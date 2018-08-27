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

local setSubSettingHashValue = function(settingKey, subKey, subVal)
	if(_type(subVal) == 'table') then subVal = cjson.encode(subVal) end
	if(_type(subVal) ~= 'string' and _type(subVal) ~= 'number') then return end
	if(_type(subKey) == 'undefined' or _type(subVal) == 'undefined') then return end
	redis.call('hset', settingKey, subKey, subVal)
end

local setSubSettingListValue = function(settingKey, subVal)
	if(_type(subVal) == 'table') then subVal = cjson.encode(subVal) end
	if(_type(subVal) == 'undefined') then return end
	if(_type(subVal) ~= 'string' and _type(subVal) ~= 'number') then return end
	redis.call('lpush', settingKey, subVal)
end

local setSettingValue = function(key, value)
	if(_type(key) == 'undefined' or _type(value) == 'undefined') then return false end
	if(not _tostring(key)) then return false end
	local key = key
	local isTable = _type(value) == 'table'
	local isList = isTable and next(value) == 1
	local isStrOrNum = _type(value) == 'string' or _type(value) == 'number'

	if(isList) then
		for _,vl in _pairs(value) do
			setSubSettingListValue('settings:'..key, vl)
		end
	elseif(isTable) then
		for k,v in _pairs(value) do
			setSubSettingHashValue('settings:'..key, k,v)
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
newSettings.synced = redis.call('TIME')[1]

newSettings = cjson.encode(newSettings)
redis.call('sadd', rk.settings, _unpack(keys))
redis.call('set', rk.settingsJson, cjson.encode(newSettings))

return redis.status_reply(newSettings)

