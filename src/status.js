const fs = require('fs').promises
const lib = require('./lib')

const status = lib.pipeAsyncFunctions(
    // get file
    async () => {
        const msg = {}
        msg.data = JSON.parse(await fs.readFile(lib.getFetchPath()))
        return msg
    },
    // print to screen
    msg => {
        const statusTime = msg.data.statusTime
        delete msg.data.statusTime
        const keys = Object.keys(msg.data)
        let str = `statusTime: ${statusTime}\n`
        for (const key of keys) {
            str += `${key}: ${msg.data[key]}\n`
        }
        console.log(str)
        return msg
    }
)
module.exports = { status }
