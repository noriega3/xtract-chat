#Server Response Layouts
##'event' responses
``TODO: will become messagepack layouts``

####init
```json
{
	"event": "init",
	"sessionId": "uuid5 string",
	"response": {
		"rooms":{
			
		}
	}

}
```

####ssoResponse
```json
{
	"event": "ssoResponse",
	"response": "uuid5 sessionId string"
}

```

####subscribe ``see below``

####unsubscribe ``see below``


##System Room Events
usage in: 
``session = session:59593-5534-553ad-6545a-66fa``
``userId = users:50030``
``app = slotsfreesocialcasino``
``app:userId = slotsfreesocialcasino:50014``

####subscribe
```json
{
	"event": "subscribed",
	"sessionId": "uuid5 string",
	"roomName": ""
}
```
####unsubscribe
```json
{
	"event": "unsubscribed",
	"sessionId": "uuid5 string",
	"roomName": "string"
}
```

##Standard Room Events
```usage in: sportsbook updates```
####subscribe
```json
{
	"event": "subscribed",
	"sessionId": "uuid5 string",
	"roomName": ""
}
```
####unsubscribe
```json
{
	"event": "unsubscribed",
	"sessionId": "uuid5 string",
	"roomName": "string delimited appname:gametype:themename:roomId"
}
```

##Game Room Events 
```usage in: turn based and realtime rooms```
####subscribe
```json
{
	"event": "subscribed",
	"sessionId": "uuid5 string",
	"roomName": ""
}
```
####unsubscribe
```json
{
	"event": "unsubscribed",
	"sessionId": "uuid5 string",
	"roomName": "string delimited appname:gametype:themename:roomId"
}
```
