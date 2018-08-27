const fs = require('fs')

const attach = (client) => {
    client.defineCommand('getConfig', {numberOfKeys: 0, lua: fs.readFileSync(process.env.NODE_PATH + "/scripts/redis2/getConfig.lua", "utf8")})
    client.defineCommand('setConfig', {numberOfKeys: 0, lua: fs.readFileSync(process.env.NODE_PATH + "/scripts/redis2/setConfig.lua", "utf8")})
}
module.exports = attach
