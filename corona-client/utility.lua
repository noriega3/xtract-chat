-------------------------------------------------
-- Our custom functions that is used throughout our apps
-- @usage local util = require("utility.util)
-------------------------------------------------
local assert = assert
local pairs = pairs
local tonumber = tonumber
local tostring = tostring
local type = type
local gsub = string.gsub
local system = system
local string = string
local math = math
local os = os
local getmetatable = getmetatable
local io = io

local util = {}
local lfs = require("lfs")
local composer = require("composer")
local crypto = require( "crypto" )

local _ipairs = ipairs
local _timerPerformWithDelay = timer.performWithDelay
local _composerGetSceneName = composer.getSceneName
local _composerGetVariable = composer.getVariable

--==================================================
--A/B split testing
--==================================================

--- Sets the A/B version to use
-- @usage util.setVersionKey()
function util.setVersionKey()
    local storeTable = require("storage.storeTable")
    local newSplitVersion = (math.random(2) == 1) and "A" or "B"
    storeTable.abSplitVersion = storeTable.abSplitVersion or newSplitVersion
    storeTable({intent="save"})
end


--- Retrieves the A/B version to use based on device id
-- @return either A or B
-- @usage util.getVersionKey() --A/B
function util.getVersionKey()
    local storeTable = require("storage.storeTable")
    return storeTable.abSplitVersion
end

--==================================================
--Math related
--==================================================

--- Rounds to the idp or 0 if no idp passed
-- @param num the number
-- @param[opt] idp how many decimal points (default: 0)
-- @usage util.round(46,2) -- 50.00
function util.round(num, idp)
    if(not tonumber(num)) then return error('Cannot round a nil number') end
    local mult = 10^(idp or 0)
    return math.floor(num * mult + 0.5) / mult
end



--==================================================
--String Manipulation
--==================================================

--- Checks if first letter starts with value
-- @param str the string to search within
-- @return bool
-- @usage util.startsWith("hellolowercase", "hello") -- true
function util.startsWith(str, search)
    return string.sub(str,1,#search) == search
end

--- Compares two md5 hashes together (shortcut function)
-- @param md5Base left side md5
-- @param md5Compare right side md5
-- @return bool
-- @usage util.validateMd5("x34394034", "x30492912") -- false
function util.validateMd5(md5Base, md5Compare)
    return md5Base == md5Compare
end

--- converts a string to an md5 checksum
-- @param str the string to create a checksum from
-- @return md5 string
-- @usage util.toMd5Checksum("something") -- a checksum to compare with
function util.toMd5Checksum(str)
    if(not str) then return false end
    return crypto.digest( crypto.md5, str)
end

--- Changes the first character of the string to uppercase
-- @param strToChange the string to change
-- @return string
-- @usage util.firstToUpper("hellolowercase") -- Hellolowercase
function util.firstToUpper(strToChange)
    return (strToChange:gsub("^%l", string.upper))
end


--- Urlencodes the string
-- @param str the string to change
function util.escape(str)
    if(str) then
        str = gsub(str, "\n", "\r\n")
        str = gsub(str, "([^%w ])",
                function (c) return string.format ("%%%02X", string.byte(c)) end)
        str = gsub(str, " ", "+")
    end
    return str
end


--- Adds commas to a number
-- @param amount the number that you want commas added to
function util.commaValue(amount)
    if (amount < 1000) then return amount end

    local k
    while true do
        amount, k = gsub(amount, "^(-?%d+)(%d%d%d)", '%1,%2')
        if (k==0) then
            break
        end
    end
    return amount
end


--- Adds a decimal to the number amount fed in
-- @param amount the number to pass in
-- @param[opt] decimal how many many decimal points, default: 2
-- @return the amount with decimal points and commas for every thousands
-- @usage util.numberFormat("30000", 4) -- 30,000.0000
function util.numberFormat(amount, decimal, noSpace)

    if(not tonumber(amount)) then return amount end
    amount = tonumber(amount)
    decimal = decimal or 2  -- default 2 decimal places
    local unit
    local famount
    local conversions = {
        --{greaterthan, divide by, String to go at the end, max decimal places}
        [1] = {1000000000, 1000000000, "B", 2},
        [2] = {100000000, 1000000, "M", 0},
        [3] = {10000000, 1000000, "M", 1},
        [4] = {1000000, 1000000, "M", 2},
        [5] = {100000, 1000, "K", 0},
        [6] = {10000, 1000, "K", 1},
        [7] = {1000, 1000, "K", 2},
    }

    for i=1, #conversions do
        if (amount >= conversions[i][1]) then
            famount = amount/(conversions[i][2])
            if (conversions[i][4] == 2)then
                famount = math.floor(100*famount)
                famount = famount / 100
            elseif(conversions[i][4] == 1)then
                famount = math.floor(10*famount)
                famount = famount / 10
            elseif(conversions[i][4] == 0)then
                famount = math.floor(famount)
            end
            unit = conversions[i][3]
            decimal = conversions[i][4]
            break
        end
    end

    local formatted
    -- comma to separate the thousands
    if (famount)then
        if (famount>1000) then
            formatted = util.commaValue(math.floor(famount))
        else
            formatted = famount
        end
    else
        formatted = string.format("%"..decimal.."d", amount)
    end

    if (unit) then
        local space = noSpace and "" or " "
        formatted = formatted..space..unit
    end

    formatted = util.trimSpaces(formatted)

    if(not formatted) then
        return amount
    end

    return formatted
end

--[[if(not tonumber(amount)) then return false end
amount = tonumber(amount)
decimal = decimal or 2  -- default 2 decimal places
local unit
local newConversions = {
    {24, "Y", "Septillion"},
    {21, "Z", "Sextillion"},
    {18, "E", "Quintillion"},
    {15, "P", "Quadrillion"},
    {12, "T", "Trillion"},
    {9, "B", "Billion"},
    {6, "M", "Million"},
    {3, "K", "Thousand"},
    --{2, "h", "Hundred"},
    --{1, "da", "Ten"},
    --{0, "", "One"}
}

--TODO: char count only works with whole numbers
local formatted = amount
local numChars = #tostring(amount)
local space = noSpace and "" or " "

for x = 1, #newConversions do
    local convNum = newConversions[x][1]
    local letter = newConversions[x][2]
    if(numChars > convNum) then
        local first = string.sub(amount, 1, -convNum-1)
        local remain = string.sub(amount, -convNum, -(convNum-decimal)-1)
        if(remain and tonumber(remain)) then
            remain = tonumber(remain) / 100
            local preformat = first + remain
            preformat = tonumber(preformat)
            print(preformat)
            --http://www.cplusplus.com/reference/cstdio/printf/
            formatted = string.format("%g%s%s", preformat, space, letter)
        else
            formatted = first..space..letter
        end
        break
    end
end
return formatted]]

function util.split(sep, str, limit)
    if not sep or sep == "" then return false end
    if not str then return false end
    limit = limit or math.huge
    if limit == 0 or limit == 1 then return {str},1 end

    local r = {}
    local n, init = 0, 1

    while true do
        local s,e = string.find(str, sep, init, true)
        if not s then break end
        r[#r+1] = string.sub(str, init, s - 1)
        init = e + 1
        n = n + 1
        if n == limit - 1 then break end
    end

    if init <= string.len(str) then
        r[#r+1] = string.sub(str, init)
    else
        r[#r+1] = ""
    end
    n = n + 1

    if limit < 0 then
        for i=n, n + limit + 1, -1 do r[i] = nil end
        n = n + limit
    end

    return r, n
end

--- Finds the specified text in the string, and replaces it with the value provided
-- @param needle the piece of text to find
-- @param replace what are we replacing the text with
-- @param haystack the string to search in
-- @return new string with the replacements
-- @usage util.findReplace("f", "D", "343fdvcc") -- "343Ddvcc"
function util.findReplace(needle, replace, haystack)
    return gsub(haystack, needle, replace)
end

--- Trims whitespace from string
-- @param str piece of string with spaces
-- @usage util.trimSpaces(" dflkdjflk dflkj ") -- "dfkdjflk dfkj"
function util.trimSpaces(str)
    return str:match'^%s*(.*%S)' or ''
end

function util.convertFromCamelCase(stringToConvert)
    stringToConvert = stringToConvert:gsub("%u+", " %1")
    stringToConvert = (stringToConvert:gsub("^%l", string.upper))
    return stringToConvert
end

--- Encodes the string provided
-- @param stringToEncode the string to url encode
-- @return the new string url encoded
-- @usage util.urlEncode("lkjlka 3034390") -- "lkjlka+3034390"
function util.urlEncode(stringToEncode)
    if(stringToEncode) then
        stringToEncode = gsub(stringToEncode, "\n", "\r\n")
        stringToEncode = gsub(stringToEncode, "([^%w ])", function (c) return string.format("%%%02X", string.byte(c)) end)
        stringToEncode = gsub(stringToEncode, " ", "+")
    end
    return stringToEncode
end

--- Checks if the string is a valid email address
-- @param stringToCheck
-- @return true|false
-- @usage util.isValidEmail("flkjdlfk@gmail.com")
function util.isValidEmail(str)

    if(not str) then
        return nil, "No text entered"
    end

    if (type(str) ~= 'string') then
        return false, "Email contains invalid characters"
    end

    if(str == "") then
        return nil, "No text entered"
    end

    local lastAt = str:find("[^%@]+$")
    local localPart = str:sub(1, (lastAt - 2)) -- Returns the substring before '@' symbol
    local domainPart = str:sub(lastAt, #str) -- Returns the substring after '@' symbol
    -- we werent able to split the email properly
    if localPart == nil then
        return nil, "Local name is invalid"
    end

    if domainPart == nil then
        return nil, "Domain is invalid"
    end
    -- local part is maxed at 64 characters
    if #localPart > 64 then
        return nil, "Local name must be less than 64 characters"
    end
    -- domains are maxed at 253 characters
    if #domainPart > 253 then
        return nil, "Domain must be less than 253 characters"
    end
    -- somthing is wrong
    if lastAt >= 65 then
        return nil, "Invalid @ symbol usage"
    end
    -- quotes are only allowed at the beginning of a the local name
    local quotes = localPart:find("[\"]")
    if type(quotes) == 'number' and quotes > 1 then
        return nil, "Invalid usage of quotes"
    end
    -- no @ symbols allowed outside quotes
    if localPart:find("%@+") and quotes == nil then
        return nil, "Invalid @ symbol usage in local part"
    end
    -- only 1 period in succession allowed
    if domainPart:find("%.%.") then
        return nil, "Too many periods in domain"
    end
    -- just a general match
    if not str:match('[%w]*[%p]*%@+[%w]*[%.]?[%w]*') then
        return nil, "Not a valid email address"
    end
    -- all our tests passed, so we are ok
    return true
end

--- Checks if the string is a valid password
-- 6-10 characters, At least one alpha AND one number, The following special chars are allowed (0 or more): !@#$%
-- @param str
--
function util.isValidPassword(str)

    if(type(str) ~= 'string') then
        return nil, "Password contains invalid characters"
    end

    if(#str < 6 or #str > 10) then
        return nil, "Password must be 6-10 characters."
    end

    if(not str:match('^(?=.*\d+)(?=.*[a-zA-Z])[0-9a-zA-Z!@#$%]{6,10}$')) then
        return nil, "Password must have one alpha and one number"
    end

    return true
end

--==================================================
--Table related
--==================================================
function util.tableLength(T)
    local count = 0
    for _ in pairs(T) do count = count + 1 end
    return count
end

function util.set (list)
    local set = {}
    for _, l in _ipairs(list) do set[l] = true end
    return set
end

---
-- Creates a table and shuffles it based on min/max inputs
-- @param min starting value
-- @param max ending value
-- @return a shuffled table thats within the range of min and max
function util.createShuffleTableMinMax(min, max)
    local tableRange = {}

    --Create a table with the range specified
    for x = min, max do
        tableRange[#tableRange+1] = x
    end

    --Handles shuffling
    local iterations = #tableRange
    local j

    for x = iterations, 2, -1 do
        j = math.random(x)
        tableRange[x], tableRange[j] = tableRange[j], tableRange[x]
    end

    return tableRange
end

function util.mergeTables(t1, t2, canOverwrite)
    for k, v in pairs(t2) do
        if(type(v) == "table") and (type(t1[k] or false) == "table") then
            util.mergeTables(t1[k], t2[k], canOverwrite)
        else
            if(not t1[k] or canOverwrite) then
                t1[k] = v
            end
        end
    end
    return t1
end

--- Checks the values and sees if the needle is in the haystack table
-- @param needle what we need to find in the table
-- @param haystack the table to search in
-- @param indexOrTable retrieve a table up to the amount, or return all indexes as a table
-- @treturn boolean of if it exists
-- @usage util.inTable(43, {2,4,5,43,2}) -- index number found at or false
function util.inTable(needle, haystack, indexOrTable)
    local valid = {}
    local valueToMatch = needle
    for i = 1, #haystack do
        local stackValue = haystack[i]
        local isMatching = valueToMatch == stackValue
        if(isMatching) then
            valid[#valid+1] = i
        end
    end

    local numMatching = #valid
    if numMatching>0 then
        if(indexOrTable) then
            if(type(indexOrTable) == "number" and indexOrTable <= numMatching) then
                return valid[indexOrTable]
            end
            return valid
        end
        return true
    end
    return false
end

--- Shuffles the referenced table
-- @param table what table are we shuffling
-- @seed seed to pass into mwc plugin for custom rng
-- @usage util.shuffleTable({4,3,2,6,7}) -- {3,7,6,2,4}
function util.shuffleTable(table, customSeed)
    local mwc = require("plugin.mwc")
    assert(type(table) == "table", "shuffleTable() expected a table, got nil")
    local rng = math.random

    if(customSeed) then
        if(not mwc or (not customSeed.z and not customSeed.w)) then return false, 'fail plugin' end
        rng = mwc.MakeGenerator{w = customSeed.w, z = customSeed.z}
        if(not rng and customSeed.throwError) then return false, 'fail generation' end
    end

    for i = #table, 2, -1 do
        local n = rng(i)
        table[i], table[n] = table[n], table[i]
    end

    return table
end

--- Synced Random Number
-- @param table what table are we shuffling
-- @seed seed to pass into mwc plugin for custom rng
-- @usage util.randomBySeed(1,2, {z=##, w=###) -- random number based off z / w seeds inputted
function util.getRandomBySeed(min, max, seeds)
    local mwc = require("plugin.mwc")
    assert(type(min) == "number", "random() expected a number, got "..type(min))
    assert(type(max) == "number", "random() expected a number, got "..type(max))
    assert(type(seeds) == "table", "random() expected a table, got "..type(seeds))
    if(not mwc or (not seeds.z and not seeds.w)) then return false, 'fail plugin' end

    local rng = mwc.MakeGenerator_Lib{w = seeds.w, z = seeds.z}

    return rng(min,max)
end

--- Receive a function that returns a random number generator based on seeds sent in
-- @param table what table are we shuffling
-- @seed seed to pass into mwc plugin for custom rng
-- @usage util.randomBySeedGenerator(#,#) -- random number based off z, w seeds inputted
-- @see https://www.math.uni-bielefeld.de/~sillke/ALGORITHMS/random/marsaglia-c
function util.randomBySeedGenerator(wSeed, zSeed)
    local mwc = require("plugin.mwc")
    assert(type(wSeed) == "number", "random() expected a number, got "..type(wSeed))
    if(not mwc or (not wSeed and not zSeed)) then return false, 'fail plugin' end
    return mwc.MakeGenerator_Lib{w = wSeed, z = zSeed}
end

--- Returns the table in the order as defined
-- @param tbl the table to sort
-- @param[opt] order function(tbl,firstval,secondval) end in which to sort the table (pass in 3 variables) (default: basic sort)
-- @treturn table
-- @usage util.sortTable({1,2,3,4,5,6}, x < y) -- ordered sorted table
function util.sortTable(tbl, order)
    -- collect the keys
    local keys = {}
    for k in pairs(tbl) do keys[#keys+1] = k end

    -- if order function given, sort by it by passing the table and keys a, b,
    -- otherwise just sort the keys
    if order then
        table.sort(keys, function(a,b) return order(tbl, a, b) end)
    else
        table.sort(keys)
    end

    -- return the iterator function
    local i = 0
    return function()
        i = i + 1
        if keys[i] then
            return keys[i], tbl[keys[i]]
        end
    end
end

--- Empties the table, and optionally nils the entire table after clearing children
-- @param tbl the table to clear
-- @param[opt] toNil if you wish to remove the table completely after child removal
-- @usage util.emptyTable({"df","dfdF"}, true) -- nil
function util.emptyTable(tbl, toNil)
    for k in pairs(tbl) do
        tbl[k] = nil
    end

    --Nil the table too
    if(toNil) then
        tbl = nil
    end
end

--- Copies the table, and does not reference the table that was fed in
-- @param tbl the table to copy
-- @param[opt] isComplex if the table has metatables, and/or recursive, set to true
-- @usage local copiedTable = util.copyTable(tableOne, true) -- outputs the copiedTable without reference to tableOne
function util.copyTable(tbl, isComplex)

    --For simple copy
    local function copySimple(tbl)
        --If is a table
        if type(tbl) ~= 'table' then
            return tbl
        end

        local res = {}
        for k, v in pairs(tbl) do
            res[copySimple(k)] = copySimple(v)
        end

        return res
    end

    --For complex copy
    local function copyComplex(obj, seen)

        -- Handle non-tables and previously-seen tables.
        if type(obj) ~= 'table' then
            return obj
        end

        if seen and seen[obj] then
            return seen[obj]
        end

        -- New table; mark it as seen an copy recursively.
        local s = seen or {}
        local res = setmetatable({}, getmetatable(obj))
        s[obj] = res
        for k, v in pairs(obj) do
            res[copyComplex(k, s)] = copyComplex(v, s)
        end

        return res
    end

    --If a complex table flag was set
    if(isComplex) then
        return copyComplex(tbl)
    else
        return copySimple(tbl)
    end

end

--- Sort table by numberic keys that are out of order
-- @t table that has numberical keys
function util.sortTableByKey(t)
    local tkeys = {}
    local returnTable = {}
    -- populate the table that holds the keys
    for k in pairs(t) do table.insert(tkeys, k) end
    -- sort the keys
    table.sort(tkeys)
    for _, k in ipairs(tkeys) do
        returnTable[k] = t[k]
    end
    return returnTable
end

--==================================================
--File Functions
--==================================================

--- Checks if the filename exists in the path provided
-- @param fname file path to the file
-- @param[opt] path path to the supposed file, default: system.DocumentsDirectory
-- @treturn boolean
-- @usage util.fileExists("path/to/file/filename.exe") -- true/false
function util.fileExists(fname, path)
    local path = path or system.DocumentsDirectory
    local results = false

    local filePath = system.pathForFile(fname, path)

    -- filePath will be 'nil' if file doesn't exist and the path is 'system.ResourceDirectory'
    if(filePath) then
        filePath = io.open(filePath, "r")
    end

    if(filePath) then
        filePath:close()
        results = true
    end

    return results
end

--- Checks if the module (that will be called by require) exists
-- @param name
--
function util.moduleExists(name)
    if package.loaded[name] then
        return true
    else
        for _, searcher in ipairs(package.searchers or package.loaders) do
            local loader = searcher(name)
            if type(loader) == 'function' then
                package.preload[name] = loader
                return true
            end
        end
        return false
    end
end

--- Checks if the folder exists and if it does not exist, creates it
-- @param folderName folder path
-- @param[opt] path path to the supposed file, default: system.DocumentsDirectory
-- @usage util.createSubFolderIfNotExists("file/path/to/tomato")
function util.createSubFolderIfNotExists(folderName, path)
    local path = path or system.DocumentsDirectory

    -- Get raw path to documents directory
    local docs_path = system.pathForFile("", path)

    -- Change current working directory
    if(lfs.chdir(docs_path))then
        lfs.mkdir(folderName)
    end
end


--==================================================
--Language Filter
--==================================================

--- Filter or check for bad words
-- @param string the string you would like to check for bad words
-- @return true if the string contained profanity
-- @usage util.profanityCheck("fuck you're mom, she's a whore")
function util.profanityCheck(textToCheck)
    local hasProfanity, cleanString
    local badWords = {"https",".com","www.","http","penis","fuck","whore","shit","bigass","damn","pussy","free webcam","8!tch","asshole","bullshit","bitch","piss","goddamn","crap","sh!t","bastard","dumbass","fag","motherfuck","nig","cunt","douche","dick","douchebag","jackass","mothafuck","pissoff","shitfull","fuk","fuckme","fvck","fcuk","b!tch","phuq","phuk","phuck","fatass","faggot","dipshit","fagot","faggit","fagget","assfuck","buttfuck","asswipe","asskiss","assclown"}

    local function trim2(s)
        return gsub(s,  "(%a)%1+", "%1")
    end
    textToCheck = string.lower(textToCheck)
    textToCheck = util.trimSpaces(textToCheck)
    textToCheck = trim2(textToCheck)

    for i=1,#badWords do
        if (string.match(textToCheck, badWords[i]))then
            hasProfanity = true
            break
        else
            hasProfanity = false
        end
    end
    return hasProfanity
end

--- Checks if various getVariables or overlay is open  (ie. chat /popup menu or an overlay box)
--
function util.areOverlaysOpen()
    return _composerGetSceneName("overlay") or _composerGetVariable("isChatOpen") or _composerGetVariable("isMainMenuShown")
end

--- Waits for an overlay to be closed then executes the onOverlayClosed function.  (change to coroutine if corona updates lua to 5.2 for greater flexibility)
-- @param onOverlayClosed
-- @return timerobject|false - in case so if we need to cancel it.
-- @usage util.waitForOverlay(function() --[[do something after overlay is finally closed--]] end)
function util.waitForOverlay(onOverlayClosed)
    local onOverlayClosed = onOverlayClosed and onOverlayClosed or function() end
    local isOverlayShown = util.areOverlaysOpen()

    --return false as first var when we aren't going to return the timer object
    if(not isOverlayShown) then
        onOverlayClosed()
        onOverlayClosed = nil
        return nil
    end

    --This is mainly for the slots, because garbage collection is currently stopped.
    collectgarbage("collect")

    -- we localize the timer function within so we can use variable within this function.
    -- TODO: Do this with all timers. this will prevent errors on timers in the future when we need to reference this parent's variables b/c its now a child of the parent. (aka lua closure)
    -- TODO: "NOTE: to pass a parameter to the listener, use a Lua closure, as in the following example:" - corona
    -- TODO: cont: https://docs.coronalabs.com/api/library/timer/performWithDelay.html
    local timerFunct = function(event)
        isOverlayShown = util.areOverlaysOpen()
        if(not isOverlayShown) then
            onOverlayClosed()
            onOverlayClosed = nil
            timer.cancel(event.source)
            event.source = nil
        end
    end
    return _timerPerformWithDelay(100, timerFunct, -1)
end

--- Waits for an scene to be shown then executes the onOverlayClosed function.  (change to coroutine if corona updates lua to 5.2 for greater flexibility)
-- @param onSceneShown
-- @return timerobject|false - in case so if we need to cancel it.
-- @usage util.waitForSceneShow(function() --[[do something after overlay is finally open and shown--]] end)
function util.waitForSceneShow(sceneName, onSceneShown)
    local onSceneShown = onSceneShown and onSceneShown or function() end
    local isSceneShown = _composerGetSceneName("current") == sceneName

    --return false as first var when we aren't going to return the timer object
    if(not isSceneShown) then
        onSceneShown()
        onSceneShown = nil
        return nil
    end

    --This is mainly for the slots, because garbage collection is currently stopped.
    collectgarbage("collect")

    -- we localize the timer function within so we can use variable within this function.
    -- TODO: Do this with all timers. this will prevent errors on timers in the future when we need to reference this parent's variables b/c its now a child of the parent. (aka lua closure)
    -- TODO: "NOTE: to pass a parameter to the listener, use a Lua closure, as in the following example:" - corona
    -- TODO: cont: https://docs.coronalabs.com/api/library/timer/performWithDelay.html
    local timerFunct = function(event)
        isSceneShown = _composerGetSceneName("current") == sceneName
        if(not isSceneShown) then
            onSceneShown()
            onSceneShown = nil
            timer.cancel(event.source)
            event.source = nil
        end
    end
    return _timerPerformWithDelay(100, timerFunct, -1)
end

--- Waits for an property to be true (change to coroutine if corona updates lua to 5.2 for greater flexibility)
-- @param object
-- @param name
-- @return proceeds with the rest of the lua function it was first delcared in
-- @link https://coronalabs.com/blog/2015/02/10/tutorial-using-coroutines-in-corona/
-- @usage util.waitUntilPropertyTrue(aNewRectObject, "isVisible")
function util.waitUntilPropertyTrue( object, name, update)
    while not object[name] do
        if update then
            update()
        end
        coroutine.yield()
    end
end
--==================================================
--Debug Functions
--==================================================

--- Shows a warning to the user with the message provided
-- @param msg the message to display on the error box
-- @raise an error dialog box to the user
-- @usage util.showWarning("hello") --Dialog box that errors user out
function util.showWarning(msg)
    if(msg) then
        local alert = native.showAlert("Warning", msg, { "OK" } )
    end

end


--- Animates the text or numToImg(numToImg.new) fields,
-- @param object
-- @param finalValue required
-- @param multiplier optional, what to divide the final number against to make it quicker
--
function util.animateCount(object, ...)
    local params = ...

    if(not object or not object.text) then return false end

    local startValue = (params.startValue and tonumber(params.startValue)) and params.startValue or 0
    local finalValue = (params.finalValue and tonumber(params.finalValue)) and params.finalValue or 0
    local onBegan = params.onBegan
    local onComplete = params.onComplete
    local numberFormat = params.numberFormat
    local animateHud = params.updateHud

    --check to make sure count is needed
    if(finalValue <= startValue) then return false end

    --stuff to do before count up
    if(onBegan) then
        onBegan({name = "counter", phase = "began", target = object})
    end

    object.setFinal = false

    local function onCountFinish(event)

        object.setFinal = true

        if(object.setNumber)then
            object:setNumber(util.commaValue(finalValue))
        else
            object.text = util.commaValue(finalValue)
        end
        if(animateHud) then
            Runtime:dispatchEvent({name="hudListener", intent="stopAnimation"})
            if(animateHud == "score") then
                --Runtime:dispatchEvent({name="hudListener", intent="updateScore"})
            elseif(animateHud == "subCurrency") then
                --Runtime:dispatchEvent({name="hudListener", intent="updateSubCurrency"})
            end
        end
        --run onComplete
        if(onComplete) then
            onComplete({name = "counter", phase = "ended", source = event.source, target = object})
        end
    end

    local amtToAdd = 1
    local amtToIncrease = 0
    local tierIndex = 1
    local tierMultiplier = 1

    if(finalValue>=100000000)then--100m
        tierMultiplier = 6
    elseif(finalValue>=10000000)then--10m
        tierMultiplier = 5
    elseif(finalValue>=1000000)then--1m
        tierMultiplier = 4
    elseif(finalValue>=100000)then--100k
        tierMultiplier = 3
    elseif(finalValue>=10000)then--10k
        tierMultiplier = 2
    end

    --TODO: tune these numbners up, possibly slow down higher numbers bc of the addition of tier multiplier
    local tiers = {
        2,--start
        3,--up to 1,000
        23,--up to 10,000
        212,--up to 100,000
        1212,--up to 1,000,000
        3121,
        21212
    }
    local nextJump = 90
    amtToAdd = tiers[tierIndex]

    local currentAmount = startValue

    local function incrementPayout(event)
        currentAmount = currentAmount + amtToAdd
        object.text = util.commaValue(currentAmount)
        if(currentAmount > nextJump)then
            nextJump = nextJump * 10
            tierIndex = tierIndex + 1
            amtToAdd = tiers[tierIndex] * tierMultiplier
        end
        if(currentAmount >= finalValue or object.setFinal)then
            onCountFinish(event)
            Runtime:removeEventListener( "enterFrame", incrementPayout )
        end
    end

    local function incrementPayoutSetNum(event)
        currentAmount = currentAmount + amtToAdd
        object:setNumber(util.commaValue(currentAmount))
        if(currentAmount > nextJump)then
            nextJump = nextJump * 10
            tierIndex = tierIndex + 1
            amtToAdd = tiers[tierIndex] * tierMultiplier
        end
        if(currentAmount >= finalValue or object.setFinal)then
            onCountFinish(event)
            Runtime:removeEventListener( "enterFrame", incrementPayoutSetNum )
        end
    end

    if(object.setNumber)then
        Runtime:addEventListener("enterFrame", incrementPayoutSetNum)
        function object:finalize( event )
            Runtime:removeEventListener( "enterFrame", incrementPayoutSetNum )
        end
    else
        Runtime:addEventListener("enterFrame", incrementPayout)
        function object:finalize( event )
            Runtime:removeEventListener( "enterFrame", incrementPayout )
        end
    end
    return true
    --[[
        local multiplier = params.multiplier and params.multiplier or (startValue / finalValue)

        --Setup win payout timers based on win amount relative to bet amount
        local timerTiers = {
            { tierWinMultiplier = 0,  secondsToRun = 1},
            { tierWinMultiplier = 3,  secondsToRun = 2},
            { tierWinMultiplier = 5,  secondsToRun = 3},
            { tierWinMultiplier = 15, secondsToRun = 5}
        }

        --See what multipler the user won
        local endingValue = finalValue
        local timerTierIndex = endingValue / (multiplier or 1)
        if(endingValue <= startValue) then timerTierIndex = 1 end

        --Loop through the tiers to see how long we should run the payout for
        local secondsToRun = 0
        for i=1,#timerTiers do
            if(timerTierIndex >= timerTiers[i]["tierWinMultiplier"]) then
                secondsToRun = timerTiers[i]["secondsToRun"]
            end
        end

        --Count the winnings the user won relative to their bet amount
        local timerPerIteration = 50
        local timeToRun = secondsToRun * 1000

        local creditsPerIteration = endingValue/(timeToRun / timerPerIteration)

        if(creditsPerIteration < 1) then
            creditsPerIteration = 1
        end
        local totalIterations = math.floor(timeToRun/timerPerIteration)
        --changed from 0 to startValue
        local tmpWinnings = startValue

        object.setFinal = false

        if(onBegan) then
            onBegan({name = "counter", phase = "began", target = object})
        end

        if(animateHud and timeToRun >= 1000) then
            Runtime:dispatchEvent({name="hudListener", intent="startAnimation", params={field=animateHud, iterations = totalIterations, time = timerPerIteration}})
        end


        local function incrementPayout(event)

            if(object) then
                --See if count is over
                if(event.count >= totalIterations or tmpWinnings >= endingValue or object.setFinal) then
                    timer.cancel(event.source)

                    --Update amount won text
                    if(object.setNumber) then
                        object:setNumber(endingValue)
                    else
                        object.text = numberFormat and util.numberFormat(endingValue) or endingValue
                    end

                    if(animateHud) then
                        Runtime:dispatchEvent({name="hudListener", intent="stopAnimation"})
                        if(animateHud == "score") then
                            --Runtime:dispatchEvent({name="hudListener", intent="updateScore"})
                        elseif(animateHud == "subCurrency") then
                            --Runtime:dispatchEvent({name="hudListener", intent="updateSubCurrency"})
                        end
                    end

                    if(onComplete) then
                        onComplete({name = "counter", phase = "ended", source = event.source, target = object})
                    end
                else
                    --Update the tmpWinnings
                    tmpWinnings = tmpWinnings + creditsPerIteration
    ]]
    --TODO: counting the wrong amount.. again? something caused this to desync again.
    --[[                if(animateHud and animateHud == "score") then
                        Runtime:dispatchEvent({name="hudListener", intent="updateScore", params={animateValue=creditsPerIteration}})
                    elseif(animateHud and animateHud == "subCurrency") then
                        print('credits per iteration score')
                        print(creditsPerIteration)
                        Runtime:dispatchEvent({name="hudListener", intent="updateSubCurrency", params={animateValue=creditsPerIteration}})
                    end]]
    --[[
                    --Update amount won text
                    if(object.setNumber) then
                        object:setNumber(math.floor(tmpWinnings))
                    else
                        object.text = numberFormat and util.numberFormat(tmpWinnings) or tmpWinnings
                    end
                end
            else

                timer.cancel(event.source)
            end
        end
        return timer.performWithDelay(timerPerIteration, incrementPayout, totalIterations)]]
end

function util:hex2rgb(hex)
    hex = hex:gsub("#","")
    return {tonumber("0x"..hex:sub(1,2))/255, tonumber("0x"..hex:sub(3,4))/255, tonumber("0x"..hex:sub(5,6))/255}
end

function util.newTabBar(...)
    local view = display.newGroup()
    local options = ...
    local configButtons = options.buttons
    local buttons = {}
    local initSelected = 0

    view.getSelected = function(self, type)

        if(type) then return self._buttons[self._indexSelected][type] end
        return self._indexSelected
    end

    view.setSelected = function(self, index)
        for x = 1, #self._buttons do
            if(x == index) then
                self._indexSelected = index
                self._buttons[x].isVisible = false
                self._buttons[x].over.isVisible = true
            else
                self._buttons[x].isVisible = true
                self._buttons[x].over.isVisible = false
            end
        end
    end

    view.setIsLocked = function(self, value)
        self._locked = value
    end

    view.finalize = function(event)
        event._indexSelected = nil
        event._buttons = nil
        event.setSelected = nil
        event:removeEventListener("finalize", event)
    end

    local function tabTouchListener(event)
        local phase = event.phase
        local target = event.target
        local parent = event.target.parent
        if(phase == "began") then
            local index = target._index
            if(view._locked or view._indexSelected == index) then return end
            parent:setSelected(target._index)
            if(target.onPress) then
                target.onPress(event)
            end
            if(options.onPress) then
                options.onPress(event)
            end
        end
    end

    for x = 1, #configButtons do
        local selectedConfig = configButtons[x]
        local xVal = 0
        local xOffset = selectedConfig.xOffset or 0

        if(selectedConfig.selected) then
            initSelected = x
        end

        if(x > 1 and buttons[x-1]) then
            xVal = buttons[x-1].x + (buttons[x-1].width)
        end

        xVal = xVal + xOffset

        buttons[x] = display.newImage(view, selectedConfig.defaultFile, xVal, 0)
        buttons[x]._index = x
        buttons[x].id = selectedConfig.id
        buttons[x]:toBack()
        buttons[x].over = display.newImage(view, selectedConfig.overFile, xVal, 0)
        buttons[x].over.isVisible = false
        buttons[x].onPress = selectedConfig.onPress
        buttons[x].finalize = function(event)
            event.txt = nil
            event.over = nil
            event.id = nil
            event._index = nil
            event:removeEventListener("finalize", event)
        end
        if(selectedConfig.label) then
            local lblOptions = selectedConfig.labelOptions and selectedConfig.labelOptions or {}
            lblOptions.parent = view
            lblOptions.x = xVal
            lblOptions.font = lblOptions.font and lblOptions.font or system.systemFontBold
            lblOptions.fontSize = lblOptions.fontSize and lblOptions.fontSize or 20
            lblOptions.text = selectedConfig.label
            buttons[x].txt = display.newText(selectedConfig.labelOptions)
            buttons[x].txt:toFront()
        end
        buttons[x]:addEventListener("touch", tabTouchListener)
        buttons[x]:addEventListener("finalize", buttons[x])
    end

    if(initSelected > 0) then
        buttons[initSelected].over.isVisible = true
        buttons[initSelected].isVisible = false
    end

    if(options.parent) then
        options.parent:insert(view)
    end

    view.anchorChildren = true
    view.anchorX = .5
    view.anchorY = .5
    view:translate(options.x or 0, options.y or 0)


    view._buttons = buttons
    view._indexSelected = initSelected

    view:addEventListener("finalize", view)

    return view
end

return util
