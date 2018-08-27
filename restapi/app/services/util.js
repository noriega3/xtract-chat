const _ = require('lodash')
const _endsWith = require('lodash/endsWith')
const _startsWith = require('lodash/startsWith')

function compareJsons(next,prev){
    console.log('fields changed', prev)

    if(_startsWith(next, '{') && _endsWith(next, '}')){
        try {
            const parsedNext = JSON.parse(next)
            const parsedPrev = JSON.parse(prev)
            const changedFields = filterChanges(parsedNext, parsedPrev)
            console.log('fields changed', changedFields, parsedNext, parsedPrev)
        } catch (e) {
            console.log("not JSON");
        }
    }
}

function filterChanges(prev, next){
    return _.fromPairs(_.differenceBy(_.entries(prev), _.entries(next), ([key, val]) => val))
}

module.exports = {
    compareJsons,
    filterChanges
}