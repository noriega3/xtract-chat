local sync = require("util.sync")
local Server = require('utilityNoobhub')
local Message = require('messageTemplates')
local restAPI = require("api.rest")
local isDebug = true
local print = isDebug and Runtime._G.print or function() end

local socket = {}
local _props = {}
local connection = {
    sessionId=nil,
    userId=nil,
    initEventId=nil,
    rooms=nil
}

local srv = Server.new({
    server='localhost',
    port=7776,
    callback=function(event) end,
    eventName="pubsub"
})

local function isAuthenticated()
    return connection.sessionId and connection.initEventId and connection.userId and connection.state == 'ready'
end

function socket.connect(cb)
    srv:connect(Message.init(),function(err, res)
        if(err) then cb(err); return false end
        if(type(res.response) ~= 'table') then print(res); return end

        connection = {
            initEventId = res.response.initEventId,
            appName = res.response.appName,
            sessionId = res.response.sessionId,
            userId = res.response.userId,
            eventId = res.response.eventId, --this changes per publish
            rooms = res.response.rooms
        }

        cb(nil, {status="CONNECTED", message="Verifying..", timeout=5000})

        srv:publish(Message.confirmInit(connection), function(errC, resC)
            print('confirming init publish')
            if(errC) then
                print('Confirm Error | Err ', errC)
                cb(errC)
                connection.state = 'init' --reset
                return false
            end
            connection.state = 'ready'
            print('confirm', resC)
            cb(nil, 'READY')
            cb = nil
        end)
    end)
end

function socket.disconnect(cb)
    srv:disconnect(nil, function(err, res)
        if(err) then cb(err); return false end
        connection = {}
        cb(nil, 'OK')
    end)
end

function socket.join(roomName, options, cb)
    options = options or {}
    if(not isAuthenticated()) then cb('UNAUTHORIZED'); return false end
    local params = options.roomProps or {}
    local performSubscribe = function(roomName) srv:publish(Message.subscribe({roomName = roomName, params = params}), cb) end

    if(not options.path) then performSubscribe(roomName); return end

    restAPI.reserveGameRoom(connection, roomName, params, function(err, roomName)
        if(err) then cb(err); return false end
        performSubscribe(roomName)
    end)
end

function socket.leave(roomName, cb)
    if(not isAuthenticated()) then cb('UNAUTHORIZED'); return false end

    if(type(roomName) == 'function') then cb = roomName end

    srv:leave(nil, function(res)
        connection = {}
    end)
end

return socket
