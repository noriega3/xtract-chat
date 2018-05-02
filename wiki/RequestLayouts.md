#Client Request Layouts
``TODO: will become messagepack layouts``
##'intent' requests
see: ``_client/node_pubsub_bridge.js:126``
####init
```json
{
	"intent": "init",
	"sessionId": "uuid5 string"
}
```

####ssoCheck
```json
{
	"intent": "ssoCheck",

}
```

####subscribe
```json
{
	"intent": "subscribe",
	"sessionId": "uuid5 string",
	"room": []
}
```

####unsubscribe
```json
{
	"intent": "unsubscribe",
	"sessionId": "uuid5 string",
	"room": []
}
```
