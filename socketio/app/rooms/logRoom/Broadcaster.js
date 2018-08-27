const Promise = require('bluebird')
const Queue = require('bull')
const os = require('os')
const _ = require('lodash')

const jobOptions = {
    delay: 5000,
    removeOnFail: true,
    removeOnComplete: true
}

const repeat = {cron: '*/2 * * * * *' }

module.exports = function (chatroom){
/*

    queue.process(() => {
        console.log('processing job', chatroom.serialize())
        const roomProps = chatroom.serialize()

        console.log()
        if(roomProps.numMembers <= 0) {

            console.log('num mebers is ', chatroom.serialize().numMembers)
            //TODO: stopped here, trying to remove repeatables
            queue.getRepeatableJobs().each((job) => {
                queue.removeRepeatable(job)
            }).then(() => {
                queue.clean(0)
            })
            return Promise.resolve('EMPTY')
        }

        chatroom.broadcastMessage({
            uptime: os.uptime(),
            totalmem: os.totalmem(),
            freemem: os.freemem(),
            loadavg: os.loadavg()
        })
        return Promise.resolve(`OK - ${Date.now()}`)
    })

    queue.on('error', (error) => {
        // An error occured.
        console.error('[Queue]: ', error.toString())
    })
*/


    //hook into add
    function addUser(props){ //if more than one parameter, switch to ...
        chatroom.addUser(props)
       /* queue.getRepeatableJobs().then((jobs) => {
            if(_.isEmpty(jobs)) {
                console.log('adding job')
                queue.add({}, {...jobOptions, repeat}).then((job) => {
                    queue.getRepeatableJobs().then((jobs) => {
                        console.log('jobs  add', jobs)
                    })
                })
            }
        })*/
    }

    //hook into remove
    function removeUser(props){ //if more than one parameter, switch to ...
        chatroom.removeUser(props)
    }



    return {
        ...chatroom,
        addUser,
        removeUser
    }
}