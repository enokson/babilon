const fs = require('fs').promises
const { existsSync } = require('fs')
const os = require('os')
const path = require('path')
// const axios = require('axios')

const pipeAsyncFunctions = (...fns) => arg => fns.reduce((p, f) => p.then(f), Promise.resolve(arg))
const getCookies = response => response.headers['set-cookie'].map(cookie => cookie.split(';')[0]).join('; ')
const getCookiePath = () => path.join(os.homedir(), '.babilon', 'cookies.json')
const getFetchPath = () => path.join(os.homedir(), '.babilon', 'fetch.json')
const parseCookie = str => {
    // 'XSRF-TOKEN=mytokenstring; expires=Tue, 07-Apr-2020 17:04:51 GMT; Max-Age=7200; path=/'
    const reducer = (acc, obj) => ({...acc, ...obj})
    const transform = (str) => {
        let arr = str.split('=')
        let k = arr[0]
        let v = arr[1]
        return { [k]: v }
    }
    return str.split('; ').map(transform).reduce(reducer, {})
}
const parseCookies = arr => {
    const reducer = (acc, cookieObj) => {
        let key = ''
        let obj = { }
        for (const k in cookieObj) {
            if (k === 'XSRF-TOKEN' || k === 'session') {
                key = k
                obj.key = cookieObj[k]
            } else {
                obj[k] = cookieObj[k]
            }
        }        
        return { ...acc, [key]: obj }
    }
    return arr.map(parseCookie).reduce(reducer, {})
} 
const saveCookies = async obj => {
    obj.savedTime = Date.now()
    const str = JSON.stringify(obj, null, 2)
    await fs.writeFile(getCookiePath(), str)
    return obj
}
const pullCookies = async () => {
    let cookiePath = getCookiePath()
    let exists = existsSync(cookiePath)
    if (!exists) {
        return
    }
    let str = await fs.readFile(cookiePath)
    let data
    try {
        data = JSON.parse(str)
    } catch (error) {
        console.log('Could not parse cookie file')
    }
    return data
}
const cookieTimeIsValid = obj => {
    // console.log(obj)
    const now = Date.now()
    const savedTime = obj.savedTime
    delete obj.savedTime
    let valid = true
    const keys = Object.keys(obj)
    for (const key of keys) {
        const cookie = obj[key]
        let test
        if (cookie['Max-Age']) {
            // console.log('checking max-age')
            const ms = cookie['Max-Age'] * 1000
            // console.log('test: %s + %s = %s', ms, savedTime, ms + savedTime)
            test = ms + savedTime
        } else if (cookie['expires']) {
            test = new Date(cookie['expires']).getTime()
        } else {
            valid = false
            break
        }
        const testPlusOneMinute = test + (1000 * 60)
        // console.log('is %s gt %s: %s', testPlusOneMinute, now, testPlusOneMinute > now)        
        if (testPlusOneMinute > now) {
            continue
        }
        valid = false
        break
    }
    return valid
}
const processReceivedCookies = async response => {
    return await saveCookies(parseCookies(response.headers['set-cookie']))
}
const serializeCookies = cookiesObj => {
    const cookiesArr = []
    const keys = Object.keys(cookiesObj)
    for (const k of keys) {
        cookiesArr.push(`${k}=${cookiesObj[k].key}`)
    }
    return cookiesArr.join('; ')
}
const pullAndSerializeCookies = async () => {
    const cookieObj = await pullCookies()
    if (!cookieObj) { return }
    if (!cookieTimeIsValid(cookieObj)) { return }
    return serializeCookies(cookieObj)
}
const getHiddenTokenFrom = responseProp => msg => {
    let token = msg[responseProp].data
    if (typeof token !== 'string') {
        msg.token = null
        return msg
    }
    let match = token.match(/name="_token" value="/)
    if (match) {
        const l = `name="_token" value="`.length
        const index = match.index
        token = token.substring(index + l)
        token = token.substring(0, token.match(/">/).index)
    } else {
        match = token.match(/name="_token" content="/)
        if (match) {
            const l = `name="_token" content="`.length
            const index = match.index
            token = token.substring(index + l)
            token = token.substring(0, token.match(/">/).index)
        } else {
            console.log('not found')
        }
    }
    msg.token = token
    return msg
}
const appendCookieStr = async msg => {
    msg.cookieStr = await pullAndSerializeCookies()
    return msg
}
const removeProp = prop => msg => {
    delete msg[prop]
    return msg
}
const saveCookiesFrom = propLocation => async msg => {
    await processReceivedCookies(msg[propLocation])
    return msg
}
const buildRequestHeaders = headers => {
    return Object.assign({
        'Host': 'i.babilon-t.tj',
        'User-Agent': 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:74.0) Gecko/20100101 Firefox/74.0',
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'X-Requested-With': 'XMLHttpRequest',
        'DNT': '1',
        'Connection': 'keep-alive'
    }, headers)
}
const buildGetRequestOptions = options => {
    return Object.assign({

        method: 'GET',

        // `xsrfCookieName` is the name of the cookie to use as a value for xsrf token
        xsrfCookieName: 'XSRF-TOKEN', // default

        // `xsrfHeaderName` is the name of the http header that carries the xsrf token value
        xsrfHeaderName: 'X-XSRF-TOKEN', // default
        
        // `maxRedirects` defines the maximum number of redirects to follow in node.js.
        // If set to 0, no redirects will be followed.
        maxRedirects: 0, // default,

        // `validateStatus` defines whether to resolve or reject the promise for a given
        // HTTP response status code. If `validateStatus` returns `true` (or is set to `null`
        // or `undefined`), the promise will be resolved; otherwise, the promise will be
        // rejected.
        validateStatus: function (_status) {
            return true; // default
        }
    }, options)
}
const buildPostRequestOptions = options => {
    return Object.assign({        
        method: 'POST',
        // `xsrfCookieName` is the name of the cookie to use as a value for xsrf token
        xsrfCookieName: 'XSRF-TOKEN', // default
        // `xsrfHeaderName` is the name of the http header that carries the xsrf token value
        xsrfHeaderName: 'X-XSRF-TOKEN', // default        
        // `maxRedirects` defines the maximum number of redirects to follow in node.js.
        // If set to 0, no redirects will be followed.
        maxRedirects: 0, // default,
        // `validateStatus` defines whether to resolve or reject the promise for a given
        // HTTP response status code. If `validateStatus` returns `true` (or is set to `null`
        // or `undefined`), the promise will be resolved; otherwise, the promise will be
        // rejected.
        validateStatus: function (status) {
            return true; // default
        }
    }, options)
}
const validateMsgObj = msg => {
    let returnMsg
    if (!msg) {
        returnMsg = {}
    } else {
        returnMsg = msg
    }
    return returnMsg
}
const parseRenewOptions = argv => {
    let planId
    let type
    switch (argv.plan) {
        case '1': planId = '1162'; break;
        case '2': planId = '1163'; break;
        case '3': planId = '1164'; break;
    }
    switch (argv.s) {
        case true: type = '0'; break;
        case false: type = '1'; break;
    }
    return { cmdOptions: { planId, type } }
}
const log = prop => msg => (prop ? console.log(msg[prop]) : console.log(msg)) || msg

// const pipe = pipeAsyncFunctions(
//     () => axios.get('http://i.babilon-t.tj/auth/login'),
//     response => { // get index
//         const msg = {}
//         msg.getResponse = response
//         return msg
//     },
//     async msg => { // process/save cookies
//         msg.cookies = await processReceivedCookies(msg.getResponse)
//         return msg
//     },
//     _msg => { // prepare for new request test
//         return {}
//     },
//     async msg => { // get cookies
//         msg.cookieStr = await pullAndSerialize()
//         return msg
//     },
//     msg => console.log(JSON.stringify(msg, null, 2))
// )
// pipe()
module.exports = {
    appendCookieStr,
    buildRequestHeaders,
    buildGetRequestOptions,
    buildPostRequestOptions,
    getCookies,
    getFetchPath,
    getHiddenTokenFrom,
    log,
    parseRenewOptions,
    pipeAsyncFunctions,
    processReceivedCookies,
    pullAndSerializeCookies,
    removeProp,
    saveCookiesFrom,
    validateMsgObj
}