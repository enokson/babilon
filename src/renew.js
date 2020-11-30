const axios = require('axios')
const lib = require('./lib')
const auth = require('./auth').auth
const querystring = require('querystring')

// for debugging
const fs = require('fs').promises

const renew = lib.pipeAsyncFunctions(
    auth,
    
    // get msg.cookieStr
    lib.appendCookieStr,
    
    // GET /internet/tariffs
    async (msg) => {
        const requestHeaders = lib.buildRequestHeaders({
            "Referer": "http://i.babilon-t.tj/internet/index",
            "Cookie": msg.cookieStr
        })
        const options = lib.buildGetRequestOptions({
            url: 'http://i.babilon-t.tj/internet/tariffs',
            headers: requestHeaders
        })
        msg.res = await axios.request(options)
        return msg
    },

    // lib.log('res'),

    // save cookies
    lib.saveCookiesFrom('res'),
    
    // get token
    lib.getHiddenTokenFrom('res'),
    
    // remove response
    lib.removeProp('res'),

    // get cookies
    lib.appendCookieStr,
    
    // POST /i_verify/
    async (msg) => {
        const requestHeaders = lib.buildRequestHeaders({
            "Referer": "http://i.babilon-t.tj/internet/changetariff",
            "Cookie": msg.cookieStr
        })
        const options = lib.buildPostRequestOptions({
            url: 'http://i.babilon-t.tj/i_verify',
            headers: requestHeaders,
            data: querystring.stringify({
                a_id: '37252',
                t_id: msg.cmdOptions.planId,
                change: msg.cmdOptions.type,
                type: 'sms',
                _token: msg.token
            })
        })
        msg.res = await axios.request(options)
        return msg
    },

    // lib.log('res'),

    // save cookies
    lib.saveCookiesFrom('res'),

    // get token
    lib.getHiddenTokenFrom('res'),

    // POST /internet/changetariff
    // add field d_verify: sms-message
    async (msg) => {
        return msg
    },

    lib.log(null)
    
    // (msg) => console.log(JSON.stringify(msg, null, 2))
)
module.exports = { renew }