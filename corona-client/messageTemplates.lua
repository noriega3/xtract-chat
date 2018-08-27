local msg = {}

function msg.init()
    --the values are retrieved from the storetable or backend
    return {
        auth = 'lasjdflkasdfjkasdjfl',
        params = {
            appName = 'source',
            userId = 786971,
            username = 'test user',
            score = 1500,
            avatar = 1,
            notifyDeviceToken = ''
        }
    }
end

function msg.confirmInit(props)
    return {
        intent="confirmInit",
        sessionId=props.sessionId,
        params={
            eventId = props.eventId,
            initEventId = props.initEventId
        }
    }
end

function msg.subscribe(props)
    return {
        intent="subscribe",
        sessionId=props.sessionId,
        roomName=props.roomName,
        params=props.params
    }
end

return msg
