const config = require('../config')
const Redis = require('ioredis-mock')
const jsf = require('json-schema-faker')
//const userSchema = require('../resources/userSchema.js')
const _ = require('lodash')
const numUsers = 5
let redis
jsf.extend('faker', function() { return require('faker') })



function createUserData(){
    let data = {
        'appnames': ['slotsfreesocialcasino', 'source', 'soundbeta'],
        'users:_nextId': 806331,

        //TODO: convert to lex when mock-ioredis supports it
/*        'users:_tokens': new Map([
            ['23c9827f-f8e8-4741-a513-c115399e5c72:0000786709', { score: 0, value: '23c9827f-f8e8-4741-a513-c115399e5c72:0000786709' }],
            ['784cf439-4fa5-4f81-bb33-01b835cd44a3:0000785511', { score: 0, value: '784cf439-4fa5-4f81-bb33-01b835cd44a3:0000785511' }],
            ['ffbef763-9e60-4cb2-85d7-7263ef7d26b4:0000780861', { score: 0, value: 'ffbef763-9e60-4cb2-85d7-7263ef7d26b4:0000780861' }],
            ['84cd9185-427a-4b76-9f4a-da46908a522f:0000781568', { score: 0, value: '84cd9185-427a-4b76-9f4a-da46908a522f:0000781568' }],
        ]),*/
        'users:_tokens': {
            '23c9827f-f8e8-4741-a513-c115399e5c72:': '23c9827f-f8e8-4741-a513-c115399e5c72:0000786709',
            '784cf439-4fa5-4f81-bb33-01b835cd44a3:': '784cf439-4fa5-4f81-bb33-01b835cd44a3:0000785511',
            'ffbef763-9e60-4cb2-85d7-7263ef7d26b4:': 'ffbef763-9e60-4cb2-85d7-7263ef7d26b4:0000780861',
            '84cd9185-427a-4b76-9f4a-da46908a522f:': '84cd9185-427a-4b76-9f4a-da46908a522f:0000781568',
        },
        //padding at prepending four 0s
        'users:_search:account:id': new Map([ //use id at front, but fixed 0
            ['0000786709::noribl87@gmail.com', {value: '00000786709::noribl87@gmail.com', score: 0}],
            ['0000785511::test@test.com', {value: '00000785511::test@test.com', score: 0}],
            ['0000780861::357218077265814', {value: '0000780861::357218077265814', score: 0}],
            ['0000781568::e15acc651d28b344909f098c8846854d', {value: '0000781568::e15acc651d28b344909f098c8846854d', score: 0}]
        ]),
        'users:_search:fb:id': new Map([ //add 0s to equalize searches both ways (fb to id and id to fb)
            ['000010100997774914952::0000786709', {value: 'noribl87@gmail.com::786709', score: 0}],
            ['000010100997773314952::0000785511', {value: 'test@test.com::785511', score: 0}]
        ]),
        'users': {
            "noribl87@gmail.com": "786709",
            "test@test.com": "785511",
            "357218077265814": "780861",
            "e15acc651d28b344909f098c8846854d": "781568"
        },
        'users:_emails':{
            "noribl87@gmail.com": "786709",
            "test@test.com": "785511"
        },
        'users:_facebook': {
            "10100997774914952": "786709"
        },

        //data requests (list)
        'users:_dataRequests': ['userId'],
        'users:_dataFiles': [ //zset hexastore
            'fileName::expireTime::userId'
        ],
        //individual users
        'users:786709:_data': ['userId'],
        'users:786709': {
            'data:source': `{"userStats":{"overall":{"plays":0,"playsPerSession":0,"wins":0,"losses":0,"sessions":19,"consecutiveWins":0,"freePlaysPerSession":0,"totalSessionLength":48027,"firstInstallDate":1502835204,"bigWins":0,"previousTimeStarted":1502932642,"autoPlaysPerSession":0,"previousSessionLength":13475},"ads":{"Intetrstitial":{"notCached":1}},"sportsbook":{"loses":{"biggestDailyLoss":0,"total":0,"amount":0,"biggestSingleLoss":0,"longestStreak":0,"currentStreak":0},"wins":{"total":0,"biggestDailyWin":0,"amount":0,"biggestSingleWin":0,"longestStreak":0,"currentStreak":0},"wagers":{"wagersMade":0,"totalWagered":0}},"slots":{"enchantedForest":{"plays":0,"RTPbets":0,"largestWin":0,"friendlyName":"Enchanted Forest","playsPerSession":0,"wins":0,"losses":0,"rtpPlays":0,"consecutiveWins":0,"freePlaysPerSession":0,"bets":0,"rtpWinnings":0,"bigWins":0,"winnings":0,"autoPlaysPerSession":0,"sessions":1},"overall":{"plays":0,"largestWin":0,"sessions":0,"wins":0,"losses":0,"consecutiveWins":0,"freePlaysPerSession":0,"bigWins":0,"winnings":0,"lastPlayedMachine":"egyptian"},"egyptian":{"plays":0,"rtpWinnings":0,"largestWin":0,"friendlyName":"Egyptian Gold","playsPerSession":0,"wins":0,"losses":0,"rtpPlays":0,"RTPbets":0,"freePlaysPerSession":0,"bets":0,"consecutiveWins":0,"bigWins":0,"winnings":0,"autoPlaysPerSession":0,"sessions":1}},"userId":false},"userBets":{"teamsBetOn":[],"overall":{"sessions":1,"previousSessionLength":0}},"userData":{"bonuses":{"replenish":[]},"lastSyncTime":1502914643,"userId":"786709","username":"Player197732","hammers":6,"levelSystem":{"progress":0,"total":0},"subCurrency":25,"likeFacebook":false,"lastSaveTime":1502835204,"accountType":"email","tutorials":{"profile":true,"lobby":true},"themesUnlocked":{"slots":{"egyptian":true,"enchantedForest":true}},"theDailyGoals":[],"avatar":"0","consecutiveDays":2,"achievements":[],"settings":{"notifications":1,"tips":1,"sounds":1,"effects":1},"ignoredEvents":[],"ratedApp":false,"lastDayOpened":228,"guestId":false,"pendingProgress":[],"unlockAdMachineTime":0,"emailAddress":false,"accountId":"noribl87@gmail.com","lastDeviceUsed":"SM-G930F","auth":"noribl87@gmail.com599469e91ea3f0.41612201","score":155000,"bonusButtonLocked":false,"linkedFcmId":"","notificationSet":false,"betAmount":{"slots":1000},"birthday":false,"level":1,"freeCoins":{"endTime":-1,"startTime":1502835204,"sessionLength":-1},"linkedFbId":"10100997774914952","unlockAdTime":0,"coinsAdTime":0}}`,
            '_lastApp': 'source',
            '_accountId': 'noribl87@gmail.com',
            '_roles': 'a',
            'data:source:auth': 'noribl87@gmail.com599469e91ea3f0.41612201',
            'data:source:lastSyncTime': '1502914643',
            'data:source:level': '1',
            '_password': 'test123123',
            '_emailAddress': 'noribl87@gmail.com',
            'data:source:username': 'Player197732',
            'data:source:consecutiveDays': '2',
            '_facebookId': '10100997774914952',
            '_appSaves': `{"source": "source"}`,
            'data:source:score': '155000',
            'data:source:avatar': '0',
            '_type': 'email'
        },
        'users:785511': {
            'data:source': `{"userStats":{"overall":{"plays":0,"playsPerSession":0,"wins":0,"losses":0,"sessions":19,"consecutiveWins":0,"freePlaysPerSession":0,"totalSessionLength":48027,"firstInstallDate":1502835204,"bigWins":0,"previousTimeStarted":1502932642,"autoPlaysPerSession":0,"previousSessionLength":13475},"ads":{"Intetrstitial":{"notCached":1}},"sportsbook":{"loses":{"biggestDailyLoss":0,"total":0,"amount":0,"biggestSingleLoss":0,"longestStreak":0,"currentStreak":0},"wins":{"total":0,"biggestDailyWin":0,"amount":0,"biggestSingleWin":0,"longestStreak":0,"currentStreak":0},"wagers":{"wagersMade":0,"totalWagered":0}},"slots":{"enchantedForest":{"plays":0,"RTPbets":0,"largestWin":0,"friendlyName":"Enchanted Forest","playsPerSession":0,"wins":0,"losses":0,"rtpPlays":0,"consecutiveWins":0,"freePlaysPerSession":0,"bets":0,"rtpWinnings":0,"bigWins":0,"winnings":0,"autoPlaysPerSession":0,"sessions":1},"overall":{"plays":0,"largestWin":0,"sessions":0,"wins":0,"losses":0,"consecutiveWins":0,"freePlaysPerSession":0,"bigWins":0,"winnings":0,"lastPlayedMachine":"egyptian"},"egyptian":{"plays":0,"rtpWinnings":0,"largestWin":0,"friendlyName":"Egyptian Gold","playsPerSession":0,"wins":0,"losses":0,"rtpPlays":0,"RTPbets":0,"freePlaysPerSession":0,"bets":0,"consecutiveWins":0,"bigWins":0,"winnings":0,"autoPlaysPerSession":0,"sessions":1}},"userId":false},"userBets":{"teamsBetOn":[],"overall":{"sessions":1,"previousSessionLength":0}},"userData":{"bonuses":{"replenish":[]},"lastSyncTime":1502914643,"userId":"786709","username":"Player197732","hammers":6,"levelSystem":{"progress":0,"total":0},"subCurrency":25,"likeFacebook":false,"lastSaveTime":1502835204,"accountType":"email","tutorials":{"profile":true,"lobby":true},"themesUnlocked":{"slots":{"egyptian":true,"enchantedForest":true}},"theDailyGoals":[],"avatar":"0","consecutiveDays":2,"achievements":[],"settings":{"notifications":1,"tips":1,"sounds":1,"effects":1},"ignoredEvents":[],"ratedApp":false,"lastDayOpened":228,"guestId":false,"pendingProgress":[],"unlockAdMachineTime":0,"emailAddress":false,"accountId":"test@test.com","lastDeviceUsed":"SM-G930F","auth":"test@test.33343424234.41612201","score":155000,"bonusButtonLocked":false,"linkedFcmId":"","notificationSet":false,"betAmount":{"slots":1000},"birthday":false,"level":1,"freeCoins":{"endTime":-1,"startTime":1502835204,"sessionLength":-1},"linkedFbId":"","unlockAdTime":0,"coinsAdTime":0}}`,
            '_lastApp': 'source',
            '_accountId': 'test@test.com',
            'data:source:auth': 'test@test.342342344234234234asdfasdfasdf234234.41612201',
            'data:source:lastSyncTime': '1502974643',
            'data:source:level': '5',
            '_emailAddress': 'test@test.com',
            '_password': 'test123',
            'data:source:username': 'PlayerTest',
            'data:source:consecutiveDays': '4',
            '_appSaves': `{"source": "source"}`,
            'data:source:score': '233',
            'data:source:avatar': '4',
            '_type': 'email'
        },
        'users:780861': {
            'data:source': `{"userStats":{"slots":{"enchantedForest":{"plays":0,"rtpWinnings":0,"largestWin":0,"friendlyName":"Enchanted Forest","playsPerSession":0,"wins":0,"losses":0,"rtpPlays":0,"RTPbets":0,"freePlaysPerSession":0,"bets":0,"consecutiveWins":0,"bigWins":0,"winnings":0,"autoPlaysPerSession":0,"sessions":1}},"overall":{"plays":0,"previousSessionLength":7423,"wins":0,"losses":0,"playsPerSession":0,"consecutiveWins":0,"totalSessionLength":22224,"freePlaysPerSession":0,"firstInstallDate":1495890468,"bigWins":0,"previousTimeStarted":1497684957,"autoPlaysPerSession":0,"sessions":4},"ads":[]},"userBets":{"overall":{"sessions":1,"previousSessionLength":0}},"userData":{"bonuses":{"replenish":[]},"avatar":"0","lastSyncTime":1497663358,"consecutiveDays":1,"achievements":[],"settings":{"notifications":1,"effects":1,"sounds":1,"tips":1},"ignoredEvents":[],"levelSystem":{"progress":0,"total":0},"level":1,"auth":"357218077265814592925ed6692c3.36006894","pendingProgress":[],"lastSaveTime":1495890468,"username":"Player906585","accountType":"guest","lastDeviceUsed":"SM-J700T","accountId":"357218077265814","freeCoins":{"endTime":-1,"startTime":1495890468,"sessionLength":-1},"userId":"780861","score":136000,"lastDayOpened":160,"betAmount":{"slots":1000},"tutorials":[],"notificationSet":false,"themesUnlocked":[],"subCurrency":25,"unlockAdTime":0,"coinsAdTime":0}}`,
            '_lastApp': 'source',
            '_accountId': '357218077265814',
            'data:source:auth': '357218077265814592925ed6692c3.36006894',
            'data:source:lastSyncTime': '1497663358',
            'data:source:level': '1',
            'data:source:username': 'Player906585',
            'data:source:consecutiveDays': '1',
            '_appSaves': `{"source":"source"}`,
            'data:source:score': '136000',
            'data:source:avatar': '0',
            '_type': 'guest'
        },
        'users:781568':{
            '_accountId': 'e15acc651d28b344909f098c8846854d',
            '_lastApp': 'source',
            'data:source:auth': 'e15acc651d28b344909f098c8846854d5b4cd88428c321.13967137',
            '_appSaves': `[]`,
            '_type': 'guest',
        }
    }

    //TODO: this needs to be separated out
    const generateUserStore = () => {
        //TODO: https://app.quicktype.io/#l=schema
        return 'ok'
    }
    //const oneUser = jsf(userSchema)

    //TODO: stopped here.
    //generateUserStore()
    /*
    return _.map(_.range(numUsers), () => {
        return faker.internet.email();
    });*/
    return data
}

redis = new Redis({
    // `options.data` does not exist in `ioredis`, only `ioredis-mock`
    data: createUserData(),
}, function(){
    console.log('redis online')

})

module.exports = redis