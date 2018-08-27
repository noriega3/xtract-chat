local networkCalls = {}
local isDebug = true
local _print = Runtime._G.print
local function print(...)
    if(isDebug) then
        _print(...)
    end
end

local buildVersion 	= system.getInfo('build')
local isSimulator 	= system.getInfo("environment") == "simulator"
local json          = require("json")
local http          = require("socket.http")
local util         = require("utility")
local cfgMain       = require("configNetwork")
local coreSubscribe = require("coreSubscribe")
local lfs 			= require("lfs")

--plugins
local _systemTimer  = system.getTimer
local _mathRandom   = math.random
local _mathPow      = math.pow
local _tonumber     = tonumber
local _stringmatch  = string.match
local _osdate	 	= os.date
local _ostime	 	= os.time

local pubsubUrl 	= cfgMain.network.pubSubApi or "http://localhost/api/v1/"
local timeoutLength = 5
http.TIMEOUT  		= timeoutLength

local isSavingProgress = false
local isReconnecting = false
local isReserving = false
local isLoggingIn = false
local isGettingRank = false
local lastSyncTrigger = 0
local interval = 5
local stopReconnector = true

local requestIds, timers = {}, {}

--easily accessible states that can be called from other parts of the game
--use these when we can do a explict require() on this module, otherwise use a composer set/get var
networkCalls.states = {
    previousRank = 0,
    saveProgress = false,
    login = false,
    guestSignUp = false
}

local function showAPIServerError(retryFunction, text)

    local function alertListener(event)
        if(event.action == "clicked") then
            local i = event.index
            if(i == 1) then
                print('retrying')
                retryFunction()
            elseif(i == 2) then
                native.requestExit()
            end
        end
    end
    native.showAlert( "Server Error", text or "The request to the server failed. Code: 7701", { "Retry", "Exit" }, alertListener)
end

local function generateInterval(k)
    local maxInterval = (_mathPow(2,k) -1) * 1000
    local nextInterval

    if(maxInterval > 30*1000) then
        maxInterval = 30*1000
    end

    nextInterval = _mathRandom() * maxInterval
    return nextInterval
end

local function checkExcludedScenes()
    return  composer.getSceneName("current") == "sceneLoadScreen" or
            composer.getSceneName("current") == "network.scenes.sceneLogout" or
            composer.getSceneName("overlay") == "network.scenes.sceneLogin" or
            composer.getSceneName("overlay") == "network.scenes.overlayGuestSignUp"
end

local function checkIfMissedSaveOrReserveRoom()

    local isLoggedIn = composer.getVariable("loginState") and composer.getVariable("loginState") == "loggedin"
    local isUserAPIAvailable = composer.getVariable("isUserAPIAvailable")
    local conditionals = {
        not checkExcludedScenes(),
        isLoggedIn,
        isUserAPIAvailable,
        composer.getVariable("missedSaveProgress"),
        not requestIds.saveProgress,
        not composer.getVariable("onLoadingScreenTasks"),
        not composer.getVariable("onLoadingScreenTasks"),
        not composer.getVariable("isExiting"),
        composer.getVariable("isGameIdle"),
        composer.getVariable("screenIdleTime") and composer.getVariable("screenIdleTime") >= 50,
    }
    local needToSync = true
    for x=1, #conditionals do
        if(not conditionals[x]) then
            needToSync = false
        end
    end

    --Check if conditionals have been satisfied
    if(needToSync) then
        print('missed a sync since last online, so syncing now.')
        networkCalls:saveProgress()
        composer.setVariable("hadInternet", true)
    end

    --==================

    local isPubSubAvailable = composer.getVariable("isPubSubAvailable")
    local cachedReserveRoom = composer.getVariable("cachedReserveRoom")
    local isPubSubConnected = composer.getVariable("serverConnected")
    local hasGameRoom = composer.getVariable("gameRoom")
    hasGameRoom = hasGameRoom and hasGameRoom ~= ""

    conditionals = {
        not checkExcludedScenes(),
        isLoggedIn,
        isUserAPIAvailable,
        isPubSubAvailable,
        not composer.getVariable("onLoadingScreenTasks"),
        not composer.getVariable("onHomeScreenTasks"),
        not composer.getVariable("isExiting"),
        composer.getVariable("isGameIdle"),
        (cachedReserveRoom and not isPubSubConnected) or (isPubSubConnected and cachedReserveRoom and not hasGameRoom)
    }
    local needToConnect = true
    for x=1, #conditionals do
        if(not conditionals[x]) then
            needToConnect = false
        end
    end

    --if there's a room to connect to, pubsub is connected, game idle and screen idle time is less than 60, reconnect to gameRoom
    if(needToConnect) then
        print('reconnect to server')
        networkCalls.reconnectToServer()
    end
end

--- Automatically tries to reconnect to server within an interval time
--
function networkCalls.startReconnectListener()
    if(composer.getVariable("isExiting")) then return end

    local state = ""
    local function syncCheck(e)
        if(composer.getVariable("isExiting") or stopReconnector) then return end
        if(timers.network) then
            timer.cancel(e.source)
            timers.network = nil
        end
        if(state == "checking") then
            local nextInterval = generateInterval(interval)
            print("next reconnect check: ".. nextInterval)
            timers.network = timer.performWithDelay(nextInterval, syncCheck)
            return
        end
        state = "checking"

        local isExcludedScene = checkExcludedScenes()
        --do a simple check of scenes to make sure no syncing happens on it.
        if(not isExcludedScene) then
            checkIfMissedSaveOrReserveRoom()
        end

        interval = interval + 1
        local nextInterval = generateInterval(interval)
        print("next reconnect check: ".. nextInterval)
        state = "ready"
        timers.network = timer.performWithDelay(nextInterval, syncCheck)
    end

    --stop any existing instances (only allow one)
    networkCalls.stopReconnectListener()

    --start new instance
    stopReconnector = false
    interval = 5
    syncCheck()
end

function networkCalls.stopReconnectListener()
    stopReconnector = true
    if(timers.network) then
        timer.cancel(timers.network)
    end
    timers.network = nil
end

--- Sends an event to other sessions to log them out of the current session from login server
-- @param userId
-- @param onComplete on sso response
--
function networkCalls.ssoCheck(userId, onComplete)
    local onComplete = onComplete and onComplete or function() end

    if(requestIds.ssoCheck) then network.cancel(requestIds.ssoCheck) end

    if(not composer.getVariable("isPubSubAvailable")) then
        return onComplete("offline")
    end

    Runtime:dispatchEvent({ name = "hudListener", intent = "startSpinner" })

    local userId    = userId and userId or storeTable.userId
    local auth      = composer.getVariable("auth")
    local sessionId = composer.getVariable("sessionId")
    if(sessionId) then sessionId = "/"..sessionId end

    local request = {
        headers = { ["Content-Type"] = "application/json" }
    }

    local function onSSOResponse(event)
        if(composer.getVariable("isExiting")) then return end
        Runtime:dispatchEvent({ name = "hudListener", intent = "stopSpinner"})

        local response = event.response and json.decode(event.response)

        if(event.status == -1 or event.isError) then
            showAPIServerError(function() network.request("https://localhost/api/v1/sso/"..appName.."/"..userId, "POST", onSSOResponse, request ,{timeout=timeoutLength}) end)
            return
        end

        if(response) then

            if(response.error) then
                local message = ""
                native.showAlert( "Login Error", message, { "Okay" } )
                return
            end

            print("--------------------------------------------------")
            print("-- SSO RESPONSE")
            print("--------------------------------------------------")
            print(response)
            print("--------------------------------------------------")
            print("-- END SSO RESPONSE")
            print("--------------------------------------------------")
        end
        return onComplete(response)
    end
    requestIds.ssoCheck = network.request("https://localhost/api/v1/sso/"..appName.."/"..userId, "GET", onSSOResponse, request ,{timeout=timeoutLength})
end

--======================================================
-- FRIENDS LIST
--======================================================

--- GET the friend list for the current user
-- @param target the object requesting the friends list
-- @param onComplete what to do afterwards
--
function networkCalls:getFriendsList(target,...)
    local params = ... or {}
    local isPubSubAvailable = composer.getVariable("isPubSubAvailable")
    local isGuestAccount = not storeTable or not storeTable.accountType or storeTable.accountType == "guest"
    local onComplete = params.onComplete and params.onComplete or function(status) return status end

    if(requestIds.friendsList) then network.cancel(requestIds.friendsList) end

    if(not isPubSubAvailable) then
        onComplete("offline")
        return
    end

    if(isGuestAccount) then
        return Runtime:dispatchEvent({name = "apiResponse", phase = "friendsList", target = target, response = {}})
    end


    local function onFriendsResponse(event)
        if(composer.getVariable("isExiting")) then return end
        local httpStatus = event.status
        local response = event.response and json.decode(event.response)

        print("--------------------------------------------------")
        print("-- FRIENDS LIST RESPONSE")
        print("--------------------------------------------------")
        print(event)
        print("--------------------------------------------------")
        print("-- END FRIENDS LIST RESPONSE")
        print("--------------------------------------------------")

        local status = "error"
        status = response and response.status or status

        if(status == "error") then
            local message = response and response.message or "Failed to retrieve data from server. Please try again later. CODE: 13"
            native.showAlert( "Login Error", message, { "Okay" } )
        elseif(status) then
            Runtime:dispatchEvent({name = "apiResponse", phase = "friendsList", target = target, response = response})
        end
        onComplete(response)
    end

    local request = {
        headers = { ["Content-Type"] = "application/json" },
        --body = json.encode(params)
    }

    requestIds.friendsList = network.request("https://localhost/api/v1/friends/"..storeTable.userId.."/"..appName, "GET", onFriendsResponse, request, { timeout = timeoutLength })
    return requestIds.friendsList
end

--- GET the userlist list based on ids passed in
-- @param target the object requesting the friends list
-- @param onComplete what to do afterwards
--
function networkCalls:getUserListByIds(target,...)
    local params = ... or {}
    local isPubSubAvailable = composer.getVariable("isPubSubAvailable")
    local isGuestAccount = not storeTable or not storeTable.accountType or storeTable.accountType == "guest"
    local onComplete = params.onComplete and params.onComplete or function(status) return status end

    if(requestIds.userList) then network.cancel(requestIds.userList) end

    if(not isPubSubAvailable) then
        onComplete("offline")
        return
    end

    if(isGuestAccount) then
        return Runtime:dispatchEvent({name = "apiResponse", phase = "userList", target = target, response = {}})
    end


    local function onUserListResponse(event)
        if(composer.getVariable("isExiting")) then return end
        requestIds.userList = nil
        local httpStatus = event.status
        local response = event.response and json.decode(event.response)

        print("--------------------------------------------------")
        print("-- USER LIST RESPONSE")
        print("--------------------------------------------------")
        print(event)
        print("--------------------------------------------------")
        print("-- END USER LIST RESPONSE")
        print("--------------------------------------------------")

        local status = "error"
        status = response and response.status or status

        if(status == "error") then
            local message = response and response.message or "Failed to retrieve data from server. Please try again later. CODE: 13"
            native.showAlert( "Login Error", message, { "Okay" } )
        elseif(status) then
            Runtime:dispatchEvent({name = "apiResponse", phase = "userList", target = target, response = response})
        end
        onComplete(response)
    end

    local request = {
        headers = { ["Content-Type"] = "application/json" },
        body = json.encode({
            appName = appName,
            requesterId = storeTable.userId,
            --add fieldnames
            linkedFbIds = params.linkedFbIds
        })
    }

    requestIds.userList = network.request("https://localhost/api/v1/userlist", "POST", onUserListResponse, request, { timeout = timeoutLength })
    return requestIds.userList
end

--- SET a new friend with an id or email from current user's friend list
-- @param searchQuery email of the friend person is adding.
--
function networkCalls:addFriend(...)
    local params = ... or {}
    local searchQuery = params.searchQuery
    if(not searchQuery or searchQuery == "") then return false end

    if(not util.isValidEmail(searchQuery) and not _tonumber(searchQuery)) then
        native.showAlert("Error", "Friend must be an email address.", {"OK"})
        return
    end

    local function onAddResponse(event)
        if(composer.getVariable("isExiting")) then return end
        local httpStatus = event.status
        local response = event.response and json.decode(event.response)

        print("--------------------------------------------------")
        print("-- ADD FRIEND RESPONSE")
        print("--------------------------------------------------")
        print(event)
        print("--------------------------------------------------")
        print("-- END ADD FRIEND RESPONSE")
        print("--------------------------------------------------")

        local status = "error"
        status = response and response.status or status
        if(status == "error") then
            local message = response and response.message or "Failed to retrieve data from server. Please try again later. CODE: 14"
            native.showAlert( "Add Friend Error", message, { "Okay" } )
        elseif(status) then

            toast.new("Friend Request Sent!")

            Runtime:dispatchEvent({name="countlyListener", intent="recordEventCount", params={key="Social:Request:Sent", count=1}})

            Runtime:dispatchEvent({name = "apiResponse", phase = "addFriend", response = response})
        end

    end

    local request = {
        headers = { ["Content-Type"] = "application/json" },
        body = json.encode(params)
    }

    return network.request("https://localhost/api/v1/friends/"..storeTable.userId.."/add", "POST", onAddResponse, request, { timeout = timeoutLength })
end

--- SET Confirms a friend request
-- @param requesterId the person this person is friending
--
function networkCalls:confirmFriend(...)
    local params = ... or {}
    local requesterId = params.requesterId
    if(not requesterId or requesterId == "") then return false end

    local function onConfirmResponse(event)
        if(composer.getVariable("isExiting")) then return end
        local httpStatus = event.status
        local response = event.response and json.decode(event.response)

        print("--------------------------------------------------")
        print("-- CONFIRM FRIEND RESPONSE")
        print("--------------------------------------------------")
        print(event)
        print("--------------------------------------------------")
        print("-- END CONFIRM FRIEND RESPONSE")
        print("--------------------------------------------------")

        local status = "error"
        status = response and response.status or status
        if(status == "error") then
            local message = response and response.message or "Failed to retrieve data from server. Please try again later. CODE: 15"
            native.showAlert( "Confirm Friend Error", message, { "Okay" } )
        elseif(status) then

            if(storeTable.ignoredEvents.friendRequests) then
                storeTable.ignoredEvents.friendRequests[requesterId] = nil
                storeTable({intent="save"})
            end

            local hasPendingFriends = response and response.response and response.response.numPending
            hasPendingFriends = hasPendingFriends and hasPendingFriends > 0
            composer.setVariable("pendingFriends", hasPendingFriends)
            Runtime:dispatchEvent({name="hudListener",intent="checkNew"})
            Runtime:dispatchEvent({name = "apiResponse", phase = "confirmFriend", response = response})
        end

    end

    params.appName = appName

    local request = {
        headers = { ["Content-Type"] = "application/json" },
        body = json.encode(params)
    }

    return network.request("https://localhost/api/v1/friends/"..storeTable.userId.."/confirm", "POST", onConfirmResponse, request, { timeout = timeoutLength })
end

--- SET Removes a friend with an id or email from current user's friend list
-- @param searchQuery email the user you want to remove from.
--
function networkCalls:removeFriend(...)
    local params = ... or {}
    local searchQuery = params.searchQuery
    if(not searchQuery or searchQuery == "") then return false end

    if(not util.isValidEmail(searchQuery) and not _tonumber(searchQuery)) then
        native.showAlert("Error", "Friend must be an email address.", {"OK"})
        return
    end

    local function onRemoveResponse(event)
        if(composer.getVariable("isExiting")) then return end
        local httpStatus = event.status
        local response = event.response and json.decode(event.response)

        print("--------------------------------------------------")
        print("-- REMOVE FRIEND RESPONSE")
        print("--------------------------------------------------")
        print(event)
        print("--------------------------------------------------")
        print("-- END REMOVE FRIEND RESPONSE")
        print("--------------------------------------------------")

        local status = "error"
        status = response and response.status or status
        if(status == "error") then
            local message = response and response.message or "Failed to retrieve data from server. Please try again later. CODE: 16"
            native.showAlert( "Remove Friend Error", message, { "Okay" } )
        elseif(status) then
            Runtime:dispatchEvent({name = "apiResponse", phase = "removeFriend", response = response})
        end

    end

    local request = {
        headers = { ["Content-Type"] = "application/json" },
        body = json.encode(params)
    }

    return network.request("https://localhost/api/v1/friends/"..storeTable.userId.."/remove", "POST", onRemoveResponse, request, { timeout = timeoutLength })
end

--- SET Removes a friend with an id or email from current user's friend request list
-- @param searchQuery email the user you want to remove from.
--
function networkCalls:denyFriendRequest(...)
    local params = ... or {}
    local searchQuery = params.requesterId
    if(not searchQuery or searchQuery == "") then return false end

    if(not util.isValidEmail(searchQuery) and not _tonumber(searchQuery)) then
        native.showAlert("Error", "User must be an email address.", {"OK"})
        return
    end

    local function onRemoveResponse(event)
        if(composer.getVariable("isExiting")) then return end
        local httpStatus = event.status
        local response = event.response and json.decode(event.response)

        print("--------------------------------------------------")
        print("-- Deny FRIEND RESPONSE")
        print("--------------------------------------------------")
        print(event)
        print("--------------------------------------------------")
        print("-- END Deny FRIEND RESPONSE")
        print("--------------------------------------------------")

        local status = "error"
        status = response and response.status or status
        if(status == "error") then
            local message = response and response.message or "Failed to retrieve data from server. Please try again later. CODE: 16"
            native.showAlert( "Deny Request Error", message, { "Okay" } )
        elseif(status) then

            if(storeTable.ignoredEvents.friendRequests) then
                storeTable.ignoredEvents.friendRequests[searchQuery] = nil
                storeTable({intent="save"})
            end

            local hasPendingFriends = response and response.response and response.response.numPending
            hasPendingFriends = hasPendingFriends and hasPendingFriends > 0
            composer.setVariable("pendingFriends", hasPendingFriends)
            Runtime:dispatchEvent({name="hudListener",intent="checkNew"})
            Runtime:dispatchEvent({name = "apiResponse", phase = "denyFriendRequest", response = response})
        end

    end

    local request = {
        headers = { ["Content-Type"] = "application/json" },
        body = json.encode(params)
    }

    return network.request("https://localhost/api/v1/friends/"..storeTable.userId.."/deny", "POST", onRemoveResponse, request, { timeout = timeoutLength })
end

--- GET Retrieves the block list for the current user
-- @param onComplete what happens afterwards
--
function networkCalls:getBlockList(target, ...)
    local params = ... or {}
    local onComplete = params.onComplete
    local function onListResponse(event)
        if(composer.getVariable("isExiting")) then return end
        local httpStatus = event.status
        local response = event.response and json.decode(event.response)

        print("--------------------------------------------------")
        print("-- BLOCK LIST RESPONSE")
        print("--------------------------------------------------")
        print(response)
        print("--------------------------------------------------")
        print("-- END BLOCK LIST RESPONSE")
        print("--------------------------------------------------")

        local status = "error"
        status = response and response.status or status

        if(status == "error") then
            local message = response and response.message or "Failed to retrieve data from server. Please try again later. CODE: 17"
            native.showAlert( "Block List Error", message, { "Okay" } )
        elseif(status) then
            --update the list of blocks or nil, which will keep the original values
            composer.setVariable("blockList", response.ids)
            Runtime:dispatchEvent({name = "apiResponse", phase = "blockList", target=target, response = response})
        end
        if(onComplete) then onComplete(event) end
    end

    local request = {
        headers = { ["Content-Type"] = "application/json" },
        --body = json.encode(params)
    }

    return network.request("https://localhost/api/v1/blocks/"..storeTable.userId, "GET", onListResponse, request, { timeout = timeoutLength })
end

--- GET Retrieves the userData for a user by email or id (mainly used for other than the current user)
-- @param searchQuery id or email of the user you wish to get info from
--
function networkCalls:getUserInfo(target, ...)
    local params = ... or {}
    local onComplete = params.onComplete
    local infoType = params.infoType and params.infoType or "profile" --gets the profile if no infoType recieved
    local function onListResponse(event)
        if(composer.getVariable("isExiting")) then return end
        local httpStatus = event.status
        local response = event.response and json.decode(event.response)

        print("--------------------------------------------------")
        print("-- USER DATA RESPONSE")
        print("--------------------------------------------------")
        print(response)
        print("--------------------------------------------------")
        print("-- END USER DATA RESPONSE")
        print("--------------------------------------------------")

        local status = "error"
        status = response and response.status or status

        if(status == "error") then
            local message = response and response.message or "Failed to retrieve data from server. Please try again later. CODE: 18"
            native.showAlert("Info Error", message, { "Okay" })
            Runtime:dispatchEvent({name = "apiResponse", phase = "userInfo", target = target, response = response})
        elseif(status) then
            Runtime:dispatchEvent({name = "apiResponse", phase = "userInfo", target = target, response = response})
        end
        if(onComplete) then onComplete(response) end
    end

    local request = {
        headers = { ["Content-Type"] = "application/json" }
    }

    return network.request("https://localhost/api/v1/info/"..appName.."/"..params.searchQuery.."/"..storeTable.userId.."/"..infoType, "GET", onListResponse, request, { timeout = timeoutLength })
end

--- GET Retrieves the play list to the roomName passed
-- @param roomName the room you wish to get the list of players from
--
function networkCalls:getPlayerList(target,...)
    local params = ... or {}
    local onComplete = params.onComplete
    local function onInfoResponse(event)
        if(composer.getVariable("isExiting")) then return end
        local httpStatus = event.status
        local response = event.response and json.decode(event.response)

        print("--------------------------------------------------")
        print("-- THEME DATA RESPONSE")
        print("--------------------------------------------------")
        print(event)
        print("--------------------------------------------------")
        print("-- END THEME DATA RESPONSE")
        print("--------------------------------------------------")

        local status = "error"
        status = response and response.status or status

        if(status == "error") then
            local message = response and response.message or "Failed to retrieve data from server. Please try again later. CODE: 181"
            native.showAlert( "Info Error", message, { "Okay" } )
            Runtime:dispatchEvent({name = "apiResponse", phase = "playerList", target = target, response = response})
        elseif(status) then
            Runtime:dispatchEvent({name = "apiResponse", phase = "playerList", target = target, response = response})
        end
        if(onComplete) then onComplete(response) end
    end

    local request = {
        headers = { ["Content-Type"] = "application/json" },
        body = json.encode({
            appName = appName,
            requesterId = storeTable.userId,
            roomName = appName..":"..params.roomName,
        })
    }
    return network.request(pubsubUrl.."room/info", "POST", onInfoResponse, request, { timeout = timeoutLength })

end

--- Adds/delete's a user with an id or email to the current user's block list
-- @param searchQuery id or email to block/unblock
-- @param onComplete what to do afterwards.  Wil return the response object ({status = "", message = ""})
--
function networkCalls:toggleBlockUser(target, ...)
    local params = ... or {}
    local searchQuery 	= params.searchQuery
    local onComplete 	= params.onComplete
    if(not searchQuery or searchQuery == "") then return false end

    if(not util.isValidEmail(searchQuery) and not _tonumber(searchQuery)) then
        native.showAlert("Error", "User must be an email address.", {"OK"})
        return
    end

    local function onToggleResponse(event)
        if(composer.getVariable("isExiting")) then return end
        local httpStatus = event.status
        local response = event.response and json.decode(event.response)

        print("--------------------------------------------------")
        print("-- ADD BLOCK LIST RESPONSE")
        print("--------------------------------------------------")
        print(event)
        print("--------------------------------------------------")
        print("-- END BLOCK LIST RESPONSE")
        print("--------------------------------------------------")

        local status = "error"
        status = response and response.status or status
        if(status == "error") then
            local message = response and response.message or "Failed to retrieve data from server. Please try again later. CODE: 19"
            native.showAlert( "Block List Error", message, { "Okay" } )
        elseif(status) then

            if(response and response.ids) then
                composer.setVariable("blockList", response.ids)
            end

            Runtime:dispatchEvent({name = "apiResponse", phase = "toggleBlock", target = target, response = response})
            if(onComplete) then onComplete(response) end
        end

    end

    local request = {
        headers = { ["Content-Type"] = "application/json" },
        body = json.encode(params)
    }

    return network.request("https://localhost/api/v1/block/"..storeTable.userId.."/toggle", "POST", onToggleResponse, request, { timeout = timeoutLength })
end

--- SET When a user sends an invite to a room to a person/friend
-- @param userId user you wish to send id to.
-- @param roomPath the full room path to the userId you are sending the invite to.
--
function networkCalls:inviteToRoom(...)
    local isMultiplayerDisabled = composer.getVariable("isMultiplayerDisabled")
    if(isMultiplayerDisabled) then return end
    local params = ... or {}

    local userId = params.userId
    local room = params.roomPath
    if(not userId or userId == "" or not room) then return false end

    if(requestIds.inviteToRoom) then network.cancel(requestIds.inviteToRoom) end

    local function onInvite(event)
        if(composer.getVariable("isExiting")) then return end
        local httpStatus = event.status
        local response = event.response and json.decode(event.response)

        print("--------------------------------------------------")
        print("-- INVITE RESPONSE")
        print("--------------------------------------------------")
        print(event)
        print("--------------------------------------------------")
        print("-- END INVITE RESPONSE")
        print("--------------------------------------------------")

        local status = "error"
        status = (response and response.status) and response.status or status
        if(status == "error") then
            local message = response and response.message or "Failed to retrieve data from server. Please try again later. CODE: 20"
            native.showAlert( "Invite Room Error", message, { "Okay" } )
        elseif(status) then
            Runtime:dispatchEvent({name = "apiResponse", phase = "inviteRoom", response = response})
        end

    end

    params.appName = appName
    params.requesterId = storeTable.userId
    params.sceneOptions = composer.getVariable("sceneOptions")
    params.sceneName = composer.getSceneName("current")

    local request = {
        headers = { ["Content-Type"] = "application/json" },
        body = json.encode(params)
    }

    requestIds.inviteToRoom = network.request(pubsubUrl.."room/invite", "POST", onInvite, request, { timeout = timeoutLength })
    return requestIds.inviteToRoom
end

--- SET When a user confirms an invite to a game room
-- @param ... retries
--
function networkCalls:confirmInviteToRoom(...)
    local params = ... or {}
    local isPubSubAvailable = composer.getVariable("isPubSubAvailable")
    local isConnected = composer.getVariable("serverConnected")
    if(not isPubSubAvailable) then return end
    local sessionId     = composer.getVariable("sessionId")
    local roomName = params.roomName

    if(params.retries and params.retries > 5) then
        Runtime:dispatchEvent({name = "apiResponse", phase = "inviteRoomConfirm", request = params, retriesLimit = true})
        --put the resveration composer var here
        return false
    end

    if(not isConnected or not sessionId or sessionId == "") then
        params.retries = params.retries and params.retries + 1 or 1

        if(not isPubSubAvailable) then return networkCalls.reserveGameRoom(params) end

        coreSubscribe:connect(function(socketReconnected)
            print(socketReconnected)
            if(socketReconnected) then
                print('socket was reconnected')
                sessionId = composer.getVariable("sessionId")
                params.sessionId = sessionId
            end
            requestIds.reserveGameRoom = networkCalls:confirmInviteToRoom(params)
            return requestIds.reserveGameRoom
        end)
    end

    if(not sessionId or not roomName or roomName == "" or not isConnected) then return false end

    if(requestIds.reserveGameRoom) then
        network.cancel(requestIds.reserveGameRoom)
        isReserving = false
    end

    local sessionId = composer.getVariable("sessionId")
    local roomName = params.roomName
    if(not sessionId or not roomName or roomName == "") then
        isReserving = false
        return false
    end

    local function onReservationResponse(event)
        if(composer.getVariable("isExiting")) then return end
        local httpStatus = event.status
        local response = event.response and json.decode(event.response)

        if(requestIds.reserveGameRoom ~= event.requestId) then return end

        isReserving = false

        print("--------------------------------------------------")
        print("-- INVITE CONFIRM RESPONSE")
        print("--------------------------------------------------")
        print(event)
        print("--------------------------------------------------")
        print("-- END CONFIRM INVITE RESPONSE")
        print("--------------------------------------------------")

        local status = "error"
        status = (response and response.status) and response.status or status
        if(status == "error") then
            local isFull = response and response.isFull

            if(isFull) then
                --still send them on their way if full, let scene / listener take care of it.
                Runtime:dispatchEvent({name = "apiResponse", requestId = event.requestId, phase = "inviteRoomConfirm", request = params, isFull = true})
            else
                --redirect to reserve game room on error
                return networkCalls.reserveGameRoom(params)
            end

        elseif(status) then
            Runtime:dispatchEvent({name = "apiResponse", requestId = event.requestId, phase = "inviteRoomConfirm", response = response.response})
        end

    end

    local request = {
        headers = { ["Content-Type"] = "application/json" },
        body = json.encode({
            userId 		= params.userId,
            roomName 	= params.roomName,
            params 		= params.params,
            sessionId 	= sessionId,
            appName 	= appName, --not really needed
            requesterId = storeTable.userId
        })
    }

    isReserving = true
    requestIds.reserveGameRoom = network.request(pubsubUrl.."room/invite/confirm", "POST", onReservationResponse, request, { timeout = timeoutLength })
    return requestIds.reserveGameRoom
end


--- SET Starts the join process of joining a room. Will output an event phase of reserveRoom
-- @param ... params, roomName, retryTimes --anything you add to the params should be carried over on the response.
--
function networkCalls.reserveGameRoom(...)
    local options = ... or {}
    local isPubSubAvailable  = composer.getVariable("isPubSubAvailable")
    local isMultiDisabled   = composer.getVariable("isMultiplayerDisabled")
    local wasExpired        = composer.getVariable("isExpired")
    local expiredRoom       = composer.getVariable("expiredGameRoom")
    local sessionId         = composer.getVariable("sessionId")
    local screenIdleTime    = composer.getVariable("screenIdleTime")

    sessionId               = (sessionId and sessionId ~= "") and sessionId or false

    local roomParams        = options.params
    local roomName          = options.roomName
    local retryTimes        = options.retryTimes and options.retryTimes+1 or 0

    --check if we need to clear past room ids
    if(wasExpired or expiredRoom) then
        composer.setVariable("isExpired", false)
        composer.setVariable("expiredGameRoom", false)
        composer.setVariable("cachedReserveRoom", false)
    end

    if(not roomName) then
        print('no room name')
        return false
    end

    --check if multiplayer was disabled
    if(isMultiDisabled) then
        print('multi disabled')
        return false
    end

    composer.setVariable("cachedReserveRoom", {roomName = roomName, params = roomParams})

    --check if they are online
    if(not isPubSubAvailable) then
        --[[       if(not composer.getVariable("hadInternet")) then
                   composer.setVariable("cachedReserveRoom", {roomName = roomName, params = roomParams})
               end]]
        --disconnect from server if need to b/c not online
        if(composer.getVariable("serverConnected")) then
            print('server not connected so dc now')
            coreSubscribe:disconnect()
        end
        return false
    end

    --Check for retry times
    if(retryTimes > 5) then
        print('retries reached')
        return false
    end

    --set new retry time
    options.retryTimes = retryTimes

    --update server connected var from the disconnect var
    if(not composer.getVariable("serverConnected") or not sessionId) then
        print('need to reconnect to socket fi111rst')
        --STOP and send a connect, then retry reserve
        return coreSubscribe:connect(function(socketReconnected)
            return networkCalls.reserveGameRoom(options)
        end)
        --=======
    end

    if(requestIds.reserveGameRoom) then
        network.cancel(requestIds.reserveGameRoom)
        isReserving	= false
    end

    local function onReservationResponse(event)
        if(composer.getVariable("isExiting")) then return end
        local httpStatus = event.status
        local response = event.response and json.decode(event.response)
        local requestId = event.requestId


        --check for matching ids to latest
        if(requestIds.reserveGameRoom ~= requestId) then return end

        isReserving	= false

        print("--------------------------------------------------")
        print("-- JOIN ROOM - RESERVATION RESPONSE")
        print("--------------------------------------------------")
        print(event)
        print("--------------------------------------------------")
        print("-- END JOIN ROOM - RESERVATION RESPONSE")
        print("--------------------------------------------------")

        if(not event.status) then
            -- for no internet right when they switch to a room.
            if(screenIdleTime > 60 and not composer.getVariable("cachedReserveRoom")) then

                --check if not isPubSubAvailable and server is connected.
                if(not isPubSubAvailable and composer.getVariable("serverConnected")) then

                    print('pubsub not avail, but server connected')
                    coreSubscribe:disconnect()
                end
                composer.setVariable("cachedReserveRoom", {roomName = roomName, params = roomParams})
            end
            return
        end

        local status = "error"
        status = response and response.status or status
        if(status == "error") then
            return networkCalls.reserveGameRoom(options)
        elseif(status == true) then
            composer.setVariable("cachedReserveRoom", false)
            Runtime:dispatchEvent({name = "apiResponse", phase = "reserveRoom", response = response.response})
        end
    end

    local dataToSend = {
        sessionId = sessionId,
        userId = storeTable.userId,
        roomName = roomName,
        params = roomParams,
        appName = appName, --not really needed
        isSimulator = isSimulator,
    }

    local request = {
        headers = { ["Content-Type"] = "application/json" },
        body = json.encode(dataToSend)
    }
    isReserving = true
    requestIds.reserveGameRoom = network.request(pubsubUrl.."room/reserve", "POST", onReservationResponse, request, { timeout = timeoutLength })
    return requestIds.reserveGameRoom
end

--- SET/GET Reconnects to the current expired room (if available) and the pubsub server.  Note: you must have been online at least once during the current session
-- @params ... retryTimes
function networkCalls.reconnectToServer(...)
    print('in reconnect')
    local options = ... or {}
    local isMultiDisabled   = composer.getVariable("isMultiplayerDisabled")
    local isServerConnected = composer.getVariable("serverConnected")
    local isPubSubAvailable = composer.getVariable("isPubSubAvailable")
    local wasExpired        = composer.getVariable("isExpired")
    local expiredRoom       = composer.getVariable("expiredGameRoom")
    local cachedReserveRoom = composer.getVariable("cachedReserveRoom")
    local sessionId         = composer.getVariable("sessionId")
    local screenIdleTime    = composer.getVariable("screenIdleTime")
    local isGameIdle	    = composer.getVariable("isGameIdle")
    sessionId               = (sessionId and sessionId ~= "") and sessionId or false
    local roomName          = expiredRoom and expiredRoom.roomName or options.roomName
    local params            = expiredRoom and expiredRoom.options or options.params
    local retryTimes        = options.retryTimes and options.retryTimes+1 or 0

    if(cachedReserveRoom) then
        roomName = cachedReserveRoom.roomName and cachedReserveRoom.roomName or false
        params   = cachedReserveRoom.params and cachedReserveRoom.params or false
    end

    --check if currently reconnecting
    if(isReconnecting) then
        if(requestIds.reconnectToGameServer) then network.cancel(requestIds.reconnectToGameServer) end
        requestIds.reconnectToGameServer = nil
        isReconnecting = false
    end

    --check if we need to connect to a game room
    if((not wasExpired or not expiredRoom) and not cachedReserveRoom) then
        print('an expired room or was expired flag not found')
        isReconnecting = false
        return false
    end

    --check if multiplayer was disabled
    if(isMultiDisabled) then
        print('multiplayer is disabled')
        isReconnecting = false
        return false
    end

    --check if they are online
    if(not isPubSubAvailable) then
        isReconnecting = false
        --composer.setVariable("cachedReserveRoom", {roomName = roomName, params = params})
        print('is not online')
        return false
    end

    --Check for retry times
    if(retryTimes > 5) then
        isReconnecting = false
        print('retries reached')
        return false, "retries"
    end

    -- check if person is idle for more than a min (auto spinners)
    if(not isGameIdle) then
        print('game is not idle or screen idle is less than 60')
        isReconnecting = false
        --composer.setVariable("cachedReserveRoom", {roomName = roomName, params = params})
        return false
    end

    --set new retry time
    options.retryTimes = retryTimes

    --update server connected var from the disconnect var
    isServerConnected = composer.getVariable("serverConnected")

    --Check if pub/sub is connected with a session id
    if(not isServerConnected or (not sessionId and cachedReserveRoom)) then
        print('need to reconnect to socket first')
        --STOP and send a connect, then retry reconnectToServer
        return coreSubscribe:connect(function(socketReconnected)
            isReconnecting = false
            return networkCalls.reconnectToServer(options)
        end)
        --==========
    end


    local function onReconnectResponse(event)

        if(composer.getVariable("isExiting")) then return end
        local httpStatus = event.status
        local response = event.response and json.decode(event.response)
        local requestId = event.requestId
        if(requestIds.reconnectToGameServer ~= requestId) then return end

        requestIds.reconnectToGameServer = nil

        isReconnecting = false
        --Ensure that this request is the latest request

        print("--------------------------------------------------")
        print("-- ROOM RECONNECTION RESPONSE")
        print("--------------------------------------------------")
        print(event)
        print("--------------------------------------------------")
        print("-- END ROOM RECONNECTION RESPONSE")
        print("--------------------------------------------------")

        local status = "error"
        status = (response and response.status) and response.status or status
        if(status == "error") then
            print('there is an error on reconnect')
            return networkCalls.reconnectToServer(options)
        elseif(status) then
            composer.setVariable("cachedReserveRoom", false)
            composer.setVariable("expiredGameRoom", false)
            composer.setVariable("isExpired", false)
            Runtime:dispatchEvent({name = "apiResponse", phase = "reserveRoom", response = response.response})
        end
    end

    local dataToSend = {
        sessionId = sessionId,
        userId = storeTable.userId,
        roomName = roomName,
        onError = "newRoom",
        params = params
    }
    local request = {
        headers = { ["Content-Type"] = "application/json" },
        body = json.encode(dataToSend)
    }

    if(requestIds.reconnectToGameServer) then network.cancel(requestIds.reconnectToGameServer) end
    isReconnecting = true
    requestIds.reconnectToGameServer = network.request(pubsubUrl.."room/reconnect", "POST", onReconnectResponse, request, { timeout = timeoutLength })
    return requestIds.reconnectToGameServer
end

--- SET Sends a request to unsubscribe from a gameRoom
-- @param ...
--
function networkCalls:leaveGameRoom(...)
    local params = ... or {}
    local roomName = params.roomName

    local isMultiplayerDisabled = composer.getVariable("isMultiplayerDisabled")
    if(isMultiplayerDisabled) then return end

    local isConnected = composer.getVariable("serverConnected")
    local sessionId = composer.getVariable("sessionId")

    if(not sessionId or not roomName or not isConnected) then return end
    params.sessionId = sessionId
    coreSubscribe.unsubscribe(roomName, params)
end

--==============================================================================
-- This is only for the account ids / device ids listed below
-- see: networkCalls.checkForStaff()
local eligibleIds = {}
local eligibleDeviceIds = {}
--==============================================================================

--- Sends the unhandledError to staff
-- @param message
--
local function sendError(message)
    local err = message
    if(not err) then return false end
    local msg = err.errorMessage
    local stack = err.stackTrace

    local function onErrorResponse(event)
        if(event.status) then
            toast.new("Error Stack Sent")
        end
    end

    local dataToSend = {

        parse="full",
        attachments = {
            {
                title = "Message",
                text = msg,
                short = true,
                color = "#F35A00"

            },
            {
                title = "Stack Trace",
                text = stack,
                short = true,
                color = "#F35A00"

            },
        },
    }

    local request = {
        headers = { ["Content-Type"] = "application/json" },
        body = json.encode(dataToSend)
    }
    return network.request("https://hooks.slack.com/services/x/x/x", "POST", onErrorResponse , request, { timeout = timeoutLength })
end

--- GET Retrieves the privacy policy from server since there's no last updated flag
-- @param onComplete what happens afterwards
--
function networkCalls:getLatestPrivacyPolicy(target, ...)
    local params = ... or {}
    local onComplete = params.onComplete
    local lastPrivacyPolicy = storeDevice.privacyPolicy.data

    local function onDownload(event)
        if(composer.getVariable("isExiting")) then return end
        local httpStatus = event.status
        local response = event.response or {}
        local message = "Failed to retrieve data from server. Please try again later. CODE: -11a"

        print("--------------------------------------------------")
        print("-- privacy policy RESPONSE")
        print("--------------------------------------------------")
        print(response)
        print("--------------------------------------------------")
        print("-- END privacy policy RESPONSE")
        print("--------------------------------------------------")

        if(httpStatus == "error") then
            if(response and response.message) then
                message = response.message
            else
                message = "Failed to retrieve data from server. Please try again later. CODE: 11m"
            end
            if(onComplete) then onComplete(false) end

        elseif(httpStatus) then
            if(response ~= lastPrivacyPolicy) then
                storeDevice.privacyPolicy.data = response
                storeDevice.privacyPolicy.updated = os.time(os.date('!*t'))
                storeDevice({intent="save"})
            end
            if(onComplete) then onComplete(storeDevice.privacyPolicy.updated)end
        else
            if(onComplete) then onComplete(false) end
        end
    end

    return network.download("http://localhost/privacy.html", "GET", onDownload,	{},	"privacy.html",	system.TemporaryDirectory)
end

--- Ping Corona bitbucket to find latest daily build and compare to simulator
-- @note: only checks via forced from debug menu or consecutive day trigger
-- @usage: networkCalls.checkForNewDailyBuild()
--
function networkCalls.checkForNewDailyBuild()
    if(not isSimulator) then return end

    --when we find a tag from onCommitResponse
    local function onTagFound(dailyBuildNumber)
        if(dailyBuildNumber == buildVersion) then return toast.new("You have the latest daily build") end

        local function onAlertSelect( event )
            if ( event.action == "clicked" ) then
                local i = event.index
                if (i == 1 or i == 2) then
                    local fileExt = i == 1 and '.dmg' or '.msi'
                    --system.openURL('https://bitbucket.org/coronalabs/')
                    --system.openURL('http://developer.coronalabs.com/corona-daily-builds/summary') fresh browser doesn't direct there
                    system.openURL('https://developer.coronalabs.com/downloads/daily-builds#tabs-1')
                    system.openURL('https://developer.coronalabs.com/sites/default/files/corona/'..dailyBuildNumber..'/Corona-'..dailyBuildNumber..fileExt)
                    os.exit(1)
                end
            end
        end
        native.showAlert('New Corona Build', 'New Version: '..dailyBuildNumber.."\nYour Version: "..buildVersion, {"Download .dmg", "Download .msi", "Cancel"}, onAlertSelect)
    end

    --listener for bitbucket
    local function onCommitResponse(event)
        local response = event.response and json.decode(event.response)
        local values = response and response.values
        local tag, message
        print(response)

        if(response and values) then
            for x=1, #values do
                if(values[x].type == "commit") then
                    message = values[x].message
                    tag = _stringmatch(message, "20%d%d%.%d+") --20xx.xxxx+
                end
                --send to onTagFound when tag is filled in
                if(tag) then return onTagFound(tag) end
            end
        else
            toast.new("Error, please try again later (checking daily)")
        end
    end
    local request = { headers = { ["Content-Type"] = "application/json" }}
    return network.request("https://api.bitbucket.org/2.0/repositories/coronalabs/api-public/commits/default", "GET", onCommitResponse, request, {timeout = timeoutLength})
end

--==========================================================================================================================================
local getLoginProps = function()
    local props = {
        ["authToken"] = storeTable.auth
    }
    if(storeTable.accountType == 'guest') then
        props["loginType"] = "deviceId"
        props["deviceId"] = storeTable.accountId
    elseif(storeTable.accountType == 'email') then
        props["email"] = storeTable.emailAddress
        if(storeTable.linkedFbId) then
            props["loginType"] = "facebook"
            props["facebookId"] = storeTable.linkedFbId
        else
            props["loginType"] = "email"
        end
    end
    return props
end

return networkCalls
