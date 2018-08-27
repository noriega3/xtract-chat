local json = require('json')
local client = {}
local timeoutLength = 3
local apiURL = "http://localhost:8080/api/v2"
local isDebug = true
local print = isDebug and Runtime._G.print or function() end



--[[client.reserveGameRoom({
    roomName = scene._roomPath,
    params = {
        sceneName = thisSceneName,
        isGameRoom = true,
    }
})]]
function client.reserveGameRoom(connection, roomName, params, cb)
    params = params or {}
    local function onResponse(event)
        print("------------------------START RESPONSE--------------------------")
        print(event)
        print("------------------------END RESPONSE--------------------------")
        local obj = json.decode(event.response)
        if(event.isError) then
            cb(event.response)
        else
            cb(nil, obj.response.roomName)
        end
    end

    network.request(apiURL.."/room/reserve", "POST", onResponse, {
        headers = { ["Content-Type"] = "application/json" },
        body = json.encode({
            sessionId = connection.sessionId,
            userId = connection.userId or 786971,--todo: get from storetable
            appName = connection.appName or 'source', --todo: get from app
            roomName = roomName,
            params = params
        })
    }, { timeout = timeoutLength })
end

--- SET When a user sends an invite to a room to a person/friend
-- @param userId user you wish to send id to.
-- @param roomPath the full room path to the userId you are sending the invite to.
--
function client.inviteToRoom(...)
    local options = ... or {}

    local body = json.encode({
        userId = "",
        roomPath = "",
        appName = "",
        requesterId = "",
        sceneOptions = {},
        sceneName = ""
    })

    local req = {
        headers = { ["Content-Type"] = "application/json" },
        body = body
    }

    return network.request(apiURL.."/room/invite", "POST", onResponse, req, { timeout = timeoutLength })
end

return client
