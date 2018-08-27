const promisify = promise => (
    promise
        .then(data => ([null, data]))
        .catch(error => ([error, null]))
)

module.exports = {
    promisify
}