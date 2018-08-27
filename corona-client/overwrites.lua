local _unpack = unpack
local composer      = require("composer")
local lastOverlay, hideTimer

--====================================
-- PRINT FUNCTION OVERWRITES COME FIRST
--====================================
local _printFunct = Runtime._G.print --opt to use io stdout instead to have more control

local function _oldPrint(fPath, ...)
    local prnt = (fPath and type(fPath) == "string") and fPath or "()"
    for i = 1,#arg do
        if arg[i] == nil then arg[i] = "not defined" end --difference between "nil" (string) and nil (undeclared).
        prnt = prnt .. tostring(arg[i]) .. "    "
    end
    if(prnt) then
        prnt = tostring(prnt).."\n"
    else
        prnt = "nil\n"
    end

    _printFunct(prnt)
end

local stringifyTable = function(tbl)
    local parsed = {}
    local output = ''

    local function add(prepend, str, append)
        if(prepend and not str and not append) then
            output = output..tostring(prepend)..'\n' --prepend is the str
        elseif(str and tostring(str)) then
            output = output..(prepend or '')..tostring(str)..(append and append or "\n")
        else
            output = output..'nil'
        end
        return output
    end

    local function parseTable(t,indent)

        if (parsed[tostring(t)]) then
            add(indent,'*'..tostring(t))
        else
            parsed[tostring(t)]=true
            if (type(t)=="table") then
                local tLen = #t
                for i = 1, tLen do
                    local val = t[i]
                    if (type(val)=="table") then
                        add(indent,"#["..i.."] => "..tostring(t).." {")
                        parseTable(val,'\t'..indent)
                        add(indent,"}")
                    elseif (type(val)=="string") then
                        add(indent,"#["..i..'] => "'..val..'"')
                    else
                        add(indent,"#["..i.."] => "..(tostring(val) or 'nil'))
                    end
                end
                for pos,val in pairs(t) do
                    if type(pos) ~= "number" or math.floor(pos) ~= pos or (pos < 1 or pos > tLen) then
                        if(type(pos) == "userdata") then
                            local mt = debug.getmetatable(pos)
                            add(mt)
                            add(indent,"[mt] => {")
                            if mt then parseTable(mt, indent..'\t') end
                            add(indent,"}")
                        elseif(type(val)=="table") then
                            add(indent,"["..pos.."] => {")
                            parseTable(val,indent..'\t')
                            add(indent,"}")
                        elseif(type(val)=="string") then
                            add(indent,'['..pos..'] => "'..val..'"')
                        else
                            add(indent,"["..pos.."] => "..(tostring(val) or 'nil'))
                        end
                    end
                end
            else
                add(tostring(t),indent)
            end
        end
    end
    add('{')
    parseTable(tbl, '\t')
    add('}')

    return output

end


--- Overwrites the print function and adds a check to see if it is a table, then output it like print_r
-- @param ...
-- @usage print(variableName)
-- @see print_r
local fp = system.pathForFile( "main.lua", system.ResourceDirectory )
local projectPath = fp and fp:gsub("main.lua", "")
function Runtime._G.print(...)

    local fPath = ""
    if(projectPath) then
        local level = 2
        while true do
            local dInfo = debug.getinfo(level, "nSl")
            local sourcePath = dInfo and dInfo.source or false

            if(sourcePath) then
                fPath = string.match(sourcePath, "[.%w]+.lua$")

                if(fPath) then
                    if(fPath ~= "Line") then
                        fPath = string.sub(fPath, 0, #fPath-4)
                    end

                    fPath = fPath.."("..dInfo.currentline.."): "
                    break
                end

                if(not fPath and level > 5) then
                    fPath = "-1"
                    break
                end
            end
            level = level + 1
        end
    end

    if(arg == nil) then
        _oldPrint(fPath..' nil')
        return
    end

    --Add debug info to print to when this error occurs
    if(arg[1] == "WARNING: timer.pause( timerId ) ignored b/c timerId is already paused.") then

        local level = 1
        while true do
            local info = debug.getinfo(level, "nSl")
            if not info then break end
            if info.what == "C" then   -- is a C function?
                _oldPrint(level, "C function")
            else   -- a Lua function
                _oldPrint(string.format("[%s]:%d", info.short_src, info.currentline))
            end
            level = level + 1
        end

    end



    --Cycle through each argument
    local finalOutput = {}
    for i=1, #arg do
        if(type(arg[i]) == 'nil') then
            finalOutput[#finalOutput+1] = 'nil'
        elseif(type(arg[i]) == "table" or type(arg[i]) == "function") then
            --If a table, output it like print_r
            finalOutput[#finalOutput+1] = stringifyTable(arg[i])
        elseif(tostring(arg[i])) then
            finalOutput[#finalOutput+1] = tostring(arg[i])
        end
    end

    if(#finalOutput > 0) then
        _oldPrint(fPath, _unpack(finalOutput))
        return
    end

    _oldPrint(fPath..'nil')

end

--Overwrite timer.pause to error locations
local _timerPause = timer.pause
timer.pause = function(object)

    if(object._expired or object._removed and composer.getVariable("isDebug")) then
        local dInfo = debug.getinfo(2)
        local fPath = ""
        local sourcePath = dInfo.source

        if(projectPath and sourcePath) then
            fPath = string.match(sourcePath, "[.%w]+.lua$") or "Line"

            if(fPath ~= "Line") then
                fPath = string.sub(fPath, 0, #fPath-4)
            end

            fPath = fPath..":"..dInfo.currentline.." "
        end
        print("ERROR: Timer should be niled/checked BEFORE call @ "..fPath)
        print(object)
    end
    _timerPause(object)
end


function table.set(t) -- set of list
    local u = { }
    for _, v in ipairs(t) do u[v] = true end
    return u
end

function table.find(f, l) -- find element v of l satisfying f(v)
    return l[f]
end

local ignoredFiles = table.set{"utilityStrict.lua", "utilityOnScreenPrint.lua", "utilityInfo.lua", "utilityPonyfont.lua", "utilityServerStatus.lua", "network.lua" }
local ignoredCalls = table.set{"_listener", "enterFrame", "print", "_oldPrint", "?", "sub_print_r", "_print", "gameLoop" }

local function trace (event, test)
    local s = debug.getinfo(2, "fnSl")

    local sourcePath = s.source
    local fPath = ""
    if(projectPath and sourcePath) then
        fPath = string.match(sourcePath, "[.%w]+.lua$") or ""
        if(table.find(fPath, ignoredFiles)) then return end
    end

    local src = s.short_src
    local functName = s.name
    if(not functName or table.find(functName, ignoredCalls)) then return end

    local line = s.currentline
    if(fPath == "" or fPath == "?" or src == "?") then return end
    _oldPrint("~["..fPath .. ":"..line.."] >> " ..functName.."()")
end

--===============================================================================
--TO ENABLE FUNCTION CALLS (HOOKS INTO ANY FUNCTION CALLS (EXCEPT FROM FILES/CALLS LISTED ABOVE)
--debug.sethook(trace, "c")
--===============================================================================

