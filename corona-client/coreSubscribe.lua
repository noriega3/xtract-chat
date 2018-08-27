-------------------------------------------------
-- FILE DESCRIPTION HERE
-------------------------------------------------
local isDebug = false
local _systemGetTimer = system.getTimer
local isSimulator 	= system.getInfo("environment") == "simulator" and true or false
local composer      = require("composer")
local config        = require("configNetwork")
local utilityNoobhub = require("utilityNoobhub")
local utility         = require("utility")
local isDisconnecting = false

local isPubSubDisabled = not config.pubsub
composer.setVariable("isMultiplayerDisabled", isPubSubDisabled)
composer.setVariable("serverConnected", false)
composer.setVariable("gameRoom", false)
--composer.setVariable("latency", "")
composer.setVariable("sessionId", false)

--	--http://ragdogstudios.com/2014/09/14/corona-sdk-improve-your-game-performances-with-object-pooling/

local clientVersion = 2

local appName = composer.getVariable("appName")
local client = {
    state = "init",
    gameRoom = nil,
    pendingGameRoom = {},
    eventIds = {},
}
local session = {
    rooms = {},
    roomPlayers = {},
    sceneRooms = {},
    retryTimes = 0,
}

local validEvents = {
    "init","ssoLogout", "ssoCheck", "ssoResponse",
    "confirmFriend", "removeFriend", "blockToggle", "pendingFriend", "inviteRoom", "denyFriendRequest",
    "userConnecting", "userConnected", "userDisconnecting", "userDisconnected", "sendChatToRoom", "receiveRoomEvent","syncSessionDataResponse",
    "subscribed", "unsubscribed", "disconnected", "roomUpdate", "playerOnline", "playerOffline", "closed"
}
local ignoredEvents = {
    "pong"
}

local noobhub = utilityNoobhub.new({
    server  	= config.server or "node.utilityapps.com",
    port 		= config.port or 7777,
    eventName 	= "rawServerResponse"
})

function client:unhandledError(event)
    self:disconnect(true)
end

local function checkExcludedScenes()
    return  composer.getSceneName("current") == "sceneLoadScreen" or
            composer.getSceneName("current") == "network.scenes.sceneLogout" or
            composer.getSceneName("overlay") == "network.scenes.sceneLogin" or
            composer.getSceneName("overlay") == "network.scenes.overlayGuestSignUp"
end

function client:toggleMaintenanceView(value)

    display.remove(client.maintenanceGroup)
    client.maintenanceGroup = nil

    if(not value) then return end
    if(checkExcludedScenes()) then return end

    local displayGroup = display.newGroup()
    displayGroup.anchorChildren = true
    displayGroup.anchorX = 0

    display.newRoundedRect(displayGroup, 0,0, display.contentWidth, 50, 50):setFillColor(0,0,0,.65)
    display.newText({
        parent = displayGroup,
        text = "NOTICE: PARTY MODE IS CURRENTLY UNDERGOING MAINTENANCE",
        fontSize = 18,
        font = fonts[1],
        align = "left",
        width = display.contentWidth,
        x = 20
    }).anchorY = 0
    displayGroup:translate(0,70)

    composer._foregroundGroup:insert(1, displayGroup)
    client.maintenanceGroup = displayGroup
end

function client:apiResponse(event)
    local phase = event.phase
    local data = event.response
    local roomName = (data and data.roomName) and data.roomName or false

    if((phase == "reserveRoom" or phase == "inviteRoomConfirm" or phase == "reconnectGameRoom") and roomName) then
        client.roomReserved = roomName
        client.subscribe(roomName, data.params)
    end
end

function client.checkKeepAlive(event)
    if(not session or not session.id or not composer.getVariable("serverConnected")) then
        --If coming from a timer
        if(event) then
            timer.cancel(event.source)
        end
        return
    end


    local currentTime = _systemGetTimer()
    local screenIdleTime = composer.getVariable("screenIdleTime")
    local lastKeepAlivePush = composer.getVariable("lastKeepAlivePush")

    local totalSinceLastPushTime = (currentTime - lastKeepAlivePush) / 1000

    if((event and screenIdleTime < 25 and totalSinceLastPushTime >= 20) or (not event and totalSinceLastPushTime >= 20)) then
        local result = client.keepAlive()
        print('keep alive yo')
        print(result)
        composer.setVariable("lastKeepAlivePush", currentTime)
    end
end

function client:rawServerResponse(event)
    Runtime:dispatchEvent({ name = "hudListener", intent = "stopSpinner"})

    if(isDebug and (event.phase and event.phase ~= "pong" and event.phase ~= "latency")) then
        print('--------------------------------------------------------------')
        print('recieve server response')
        print(event)
        print('--------------------------------------------------------------')
    end
    local eventId = event.eventId
    local room = event.room
    local phase = event.phase
    local response = event.response
    local message = event.message

    if(message) then
        toast.new(message);
    end

    --Global server error handling
    if(event.error) then

        if(event.phase == "closed") then
            print('closed via raw')
            client:disconnect(true)
        elseif(event.phase == "unstable") then
            toast.new(event.error);
        elseif(event.phase == "onUnexpectedEnd") then

        end
    end

    if(phase == "error") then

        if(not response or not response.isExpired) then
            client:toggleMaintenanceView(true)
        end

        local message = response.message
        local errorPhase = response.phase or "n/a"
        local messageType = type(message)
        if(messageType == "table") then
            print('------------------------------------')
            print('SERVER ERROR:')
            print('Phase:', errorPhase)
            print(response.message)
            print('------------------------------------')
        elseif(messageType == "string") then
            print(response)
            toast.new(response.message);
            Runtime:dispatchEvent({name="pubSubResponse", phase=phase, room=room, response = response})
        end

        if(client.onConnect) then
            client.onConnect(false)
        end
        client.onConnect = nil
        return
    end

    if(phase == "init") then
        client:toggleMaintenanceView(false)
        if(not response.sessionId) then return false end
        composer.setVariable("serverConnected", true)

        client:checkForPrevious(session.id, response.sessionId)

        session.id = response.sessionId
        session.roomData = {}
        session.retryTimes = 0
        print("SETTING SESION ID")
        composer.setVariable("sessionId", response.sessionId)


        for x = 1, #response.rooms do
            local name = response.rooms[x]
            session.rooms[name] = true
            session.roomPlayers[name] = {}
        end

        local currentTime = _systemGetTimer()
        client.idleTimer = timer.performWithDelay(15000, client.checkKeepAlive, -1)
        composer.setVariable("lastKeepAlivePush", currentTime)
        composer.setVariable("playerIdleTime", 0)
        --client.pinger = timer.performWithDelay(5000, function() client.ping() end, -1)
        -- User has connected to server, so perform checks and transition scene if needed
        if(client.onConnect) then
            if(client.connector) then
                local status, errorMsg = coroutine.resume(client.connector)
                if(errorMsg) then
                    if(composer.getVariable("isDebug") or isSimulator) then error(errorMsg) end
                    print('Error on sub connector')
                end
            end
            client.onConnect(true)
            client.onConnect = nil
        end

    elseif(phase == "subscribed" and session.id == response.sessionId) then
        session.rooms[room] = true
        session.roomPlayers[room] = {}
        session.retryTimes = 0
        if(response.isGameRoom and client.pendingGameRoom[room]) then
            client.gameRoom = {
                roomName = room,
                options = client.pendingGameRoom[room] and client.pendingGameRoom[room].options or {},
            }
            client.pendingGameRoom[room] = nil
            composer.setVariable("gameRoom", room)
            composer.setVariable("expiredGameRoom", false)
            composer.setVariable("isExpired", false)
        end

    elseif(phase == "unsubscribed" and session.id == response.sessionId) then
        local isExpired = response.isExpired
        session.rooms[room] = nil
        session.roomPlayers[room] = nil
        if(response.isGameRoom and client.gameRoom and room == client.gameRoom.roomName) then
            if(not isExpired) then
                client.gameRoom = nil
                composer.setVariable("gameRoom", "")
            end
            if(client.gameRoom and not client.pendingGameRoom[room]) then
                print('set here')
                composer.setVariable("expiredGameRoom", client.gameRoom)
                composer.setVariable("gameRoom", "")
            end
        end
    elseif(phase == "disconnected" and (session.id == response.sessionId or room == "Server")) then
        local isServer = room == "Server"
        local isExpired = isServer or response.isExpired
        client:disconnect(isExpired, isServer)
    elseif(phase == "pong") then
        --composer.setVariable("latency", utility.round(_systemGetTimer() - response.startPing))
        return

    elseif(phase =="roomUpdate") then
        if(response and response.players) then
            session.roomPlayers[room] = {} --reset temporarily in case people d/c
            for k,v in pairs(response.players) do
                if(v and v.userId) then
                    session.roomPlayers[room][v.userId] = v
                end
            end
        end
    end


    if(response and response.eventId and client.eventIds[response.eventId]) then

        client.confirmEventId(response.eventId)
        client.eventIds[response.eventId] = nil

        if(phase == "syncSessionDataResponse") then return end

        --Send the verified response to all places that have the listener attached
        Runtime:dispatchEvent({name = "pubSubResponse", phase = phase, event = response.event, room=room, response = response})
    elseif(utility.inTable(phase, validEvents)) then
        Runtime:dispatchEvent({name="pubSubResponse", phase=phase, room=room, response=response})
    elseif(not phase or not utility.inTable(phase, ignoredEvents)) then
        print('============================')
        print('No valid event attached for event:')
        print(event)
        print(phase)
        print('============================')
        --when server syntax error or malformed data coming in
        if(client.onConnect) then
            client.onConnect(false)
        end
        client.onConnect = nil
    end
end

--==========================================================================================
--==========================================================================================
--- Checks the status of the server on the inital launch of app in sceneLoadScreen
function client:connect(onComplete)

    if(isPubSubDisabled) then return onComplete(false) end
    if(self.state == "busy") then
        return onComplete(false)
    end
    self.state = "busy"
    local isOnline = composer.getVariable("isPubSubAvailable")

    if(isOnline) then
        self.errorTimes = 0
        self.state = "ready"
        local userData = {
            appName = appName,
            userId = storeTable.userId,
            username = storeTable.username,
            score = storeTable.score,
            avatar = storeTable.avatar
        }
        if(not noobhub:connect(userData)) then
            onComplete(false)
        else
            --attach for the pubsubListener to handle
            client.onConnect = onComplete
        end
    else
        print('offline')
        self.state = "offline"
        return onComplete(false)
    end

    Runtime:dispatchEvent({ name = "hudListener", intent = "stopSpinner"})
end

function client:disconnect(isExpired, isServer)

    if(isDisconnecting) then return end
    isDisconnecting = true
    if(client.pinger) then
        timer.cancel(client.pinger)
    end
    if(client.idleTimer) then
        timer.cancel(client.idleTimer)
    end

    client.pinger = nil
    client.clientTimer = nil
    client.lastScore = nil

    composer.setVariable("serverConnected", false)
    noobhub:disconnect()

    composer.setVariable("gameRoom", false)
    composer.setVariable("sessionId", false)

    if(isExpired) then
        composer.setVariable("isExpired", true)
        composer.setVariable("expiredGameRoom", client.gameRoom)
    else
        client.eventIds = {}
        composer.setVariable("isExpired", false)
        composer.setVariable("expiredGameRoom", false)
    end
    client.gameRoom = nil
    client.pendingGameRoom = {}

    if(isServer and not isExpired) then

        client:toggleMaintenanceView(true)
    end

    isDisconnecting = false
end

function client:checkForPrevious(currentId, newId)

    if(currentId and currentId ~= newId) then

        if(client.gameRoom and client.gameRoom.roomName) then
            Runtime:dispatchEvent({name="pubSubResponse", phase="sessionChange", room=client.gameRoom.roomName, response={
                sessionId = currentId,
                newSessionId = newId
            }})
        end
    end
end

function client.subscribe(roomName, options)
    local options = options and options or {}

    if(options.isGameRoom) then
        composer.setVariable("reserveGameRoom", {
            roomName = roomName,
            options = options
        })
    end

    if(client.state ~= "ready") then return false end


    if(options.isGameRoom) then
        composer.setVariable("cachedReserveRoom", false)
        Runtime:dispatchEvent({name="hudListener", intent="hidePubSubOffline"})

        client.pendingGameRoom[roomName] = {
            roomName = roomName,
            options = options
        }
        client.startPing = system.getTimer()
    end

    --Fill in the values from game store
    if(options.userData) then
        for k,v in pairs(options.userData) do
            options[k] = storeTable[k]
        end
    end

    local dataToSend = {
        intent = "subscribe",
        roomName = roomName,
        params = options
    }
    if(not noobhub:publish(dataToSend)) then
        composer.setVariable("cachedReserveRoom", {
            roomName = roomName,
            params = options
        })
    end
end

function client.publish(params)

    print('publlish', params)
    if(client.state ~= "ready" and not noobhub or not noobhub.sock) then print('not ready') return false end
    local eventId = storeTable.userId.."|"..params.intent.."|"..tostring(os.time(os.date('!*t')))
    client.eventIds[eventId] = true
    params.eventId = eventId
    params.sessionId = session.id
    params.userId = storeTable.userId
    return noobhub:publish(params)
end

function client.unsubscribe(roomName, options)

    if(client.state ~= "ready") then return false end

    local options = options and options or {}
    local isGameRoom 	= options.isGameRoom
    local sessionId 	= options.sessionId

    local dataToSend = {
        intent = "unsubscribe",
        roomName = roomName,
        params = options
    }

    if(client.pendingGameRoom and isGameRoom) then
        client.pendingGameRoom[roomName] = nil
    end

    if(not noobhub:publish(dataToSend)) then
        print('unsub pub')
        --this is same as return from server.
        session.rooms[roomName] = nil
        session.roomPlayers[roomName] = nil
        if(isGameRoom and composer.getVariable("gameRoom") and client.gameRoom and composer.getVariable("gameRoom") == client.gameRoom.roomName) then
            Runtime:dispatchEvent({name="hudListener", intent="showPubSubOffline"})
            composer.setVariable("expiredGameRoom", client.gameRoom)
            composer.setVariable("gameRoom", "")
        end
    end
end

function client.ping(options)
    local params = options or {}
    local dataToSend = {
        intent = "ping",
        params = params
    }
    noobhub:publish(dataToSend)
end

function client.keepAlive()

    if(client.state ~= "ready" or not noobhub or not noobhub.sock) then return false end

    local dataToSend = {
        intent = "keepAlive",
        params = {
            startPing = _systemGetTimer()
        }
    }
    return noobhub:publish(dataToSend)
end

function client.confirmEventId(id)
    if(client.state ~= "ready") then return false end
    return noobhub:publish({
        intent = "eventConfirm",
        eventId = id
    })
end

function client.syncSessionData(forceRoomUpdate)
    if(client.state ~= "ready" or not noobhub or not noobhub.sock) then return false end

    --Check if we are wasting a request b/c score is the same from last time
    if(not storeTable or (client.lastScore and storeTable.score and storeTable.score == client.lastScore)) then return end
    client.lastScore = storeTable.score

    local eventId = storeTable.userId.."|syncSessionData|"..tostring(os.time(os.date('!*t')))
    client.eventIds[eventId] = true

    print('sync pub')
    return noobhub:publish({
        intent = "syncSessionData",
        eventId = eventId,
        params = {
            appName = appName,
            userId = storeTable.userId,
            auth = storeTable.auth,
            username = storeTable.username,
            score = storeTable.score,
            level = storeTable.level,
            subCurrency = storeTable.subCurrency,
            avatar = storeTable.avatar,
            forceRoomUpdate = forceRoomUpdate,
        }
    })
end

function client.checkNextMaintance()

end

function client:getRoomPlayers(roomName)

    if(roomName) then
        return session.roomPlayers[roomName]
    end

    return session.roomPlayers
end

Runtime:addEventListener("unhandledError", client)
Runtime:addEventListener("rawServerResponse", client)
Runtime:addEventListener("apiResponse", client)

return client
