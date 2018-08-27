const ServerRoom = require('../rooms/ServerRoom')
const LogRoom = require('../rooms/LogRoom')
module.exports = [
    {
        name: '_server:status',
        custom: ServerRoom
    },
    {
        name: '_server:log:api',
        custom: LogRoom
    },
    {
        name: '_server:log:tcp',
        custom: LogRoom
    },
    {
        name: '_server:log:ws',
        custom: LogRoom
    },
    {
        name: 'Alexandria',
        image: 'chatrooms/alexandria.jpg'
    },
    {
        name: 'Sanctuary',
        image: 'chatrooms/sanctuary.jpg'
    },
    {
        name: 'Hilltop',
        image: 'chatrooms/hilltop.jpg'
    }
]
