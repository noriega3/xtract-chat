local network = {
    clientVersion = 1,
    pubSubApi = "http://localhost:8080/api/v2/",
    server = "localhost",
    port = 7777,
    timesOffline = 7 -- days the person can be offline before alerting user
}
return network
