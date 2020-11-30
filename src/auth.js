const axios = require('axios')
const querystring = require('querystring');
const lib = require('./lib')

const auth = lib.pipeAsyncFunctions(
    lib.validateMsgObj,
    // GET /auth/login
    async (msg) => {
        msg.res = await axios.get('http://i.babilon-t.tj/auth/login')
        return msg
    },
    // save cookies
    lib.saveCookiesFrom('res'),
    // get hidden token
    lib.getHiddenTokenFrom('res'),
    // delete msg.getResponse
    lib.removeProp('res'),
    // get cookie from file
    lib.appendCookieStr,
    // POST /auth/login
    async msg => {
        const headers = lib.buildRequestHeaders({
            "Referer": "http://i.babilon-t.tj/auth/login"
        })
        const options = lib.buildPostRequestOptions({
            url: 'http://i.babilon-t.tj/auth/login',
            headers,
            data: querystring.stringify({
                login: 'lte_992446901694',
                password: 'r31l4BID',
                lang: 'en',
                _token: msg.token
            })
        })
        msg.res = await axios.request(options)
        delete msg.token
        // console.log(msg)
        return msg
    },
    lib.saveCookiesFrom('res'),
    // lib.log('res'),
    lib.removeProp('res')
    // msg => console.log(JSON.stringify(msg, null, 2))
)

module.exports = {
    auth
}
