const axios = require('axios')
const { auth } = require('./auth')
const lib = require('./lib')
const fs = require('fs').promises

const pullTable = str => {
    const index = str.match(/<table/).index
    const endIndex = str.match(/<\/table>/).index
    const endRegExLength = '</table>'.length    
    return str.substring(index, endIndex + endRegExLength)
}
const pullTables = str => {
    let tables = []
    while (str.includes('<table')) {
        let table = pullTable(str)
        str = str.replace(table, '')
        tables.push(table)
    }
    return tables
}
const pullTr = str => {
    const index = str.match(/<tr/).index
    const endIndex = str.match(/<\/tr>/).index
    const endRegExLength = '</tr>'.length    
    return str.substring(index, endIndex + endRegExLength)
}
const pullTrs = str => {
    let trs = []
    while (str.includes('<tr')) {
        let tr = pullTr(str)
        str = str.replace(tr, '')
        trs.push(tr)
    }
    return trs
}
const pullTd = str => {
    const index = str.match(/<td/).index
    const endIndex = str.match(/<\/td>/).index
    const endRegExLength = '</td>'.length    
    return str.substring(index, endIndex + endRegExLength)
}
const pullTds = str => {
    let trs = []
    while (str.includes('<td')) {
        let tr = pullTd(str)
        str = str.replace(tr, '')
        trs.push(tr)
    }
    return trs
}
const mkKV = arr => {
    let k = arr[0]
    let v = arr[1]
    let firstIndex = k.match(/>/).index
    let lastIndex
    try {
       lastIndex = k.match(/:/).index
    } catch (error) {
        lastIndex = k.match(/<td/).index
    }
    k = k.substring(firstIndex + 1, lastIndex)
    firstIndex = v.match(/>/).index
    lastIndex = v.match(/<\//).index
    v = v.substring(firstIndex + 1, lastIndex)
    return [k,v]
}

const fetch = lib.pipeAsyncFunctions(
    auth,
    // get cookies
    async msg => {
        msg.cookieStr = await lib.pullAndSerializeCookies()
        return msg
    },
    // get /internet/index
    async msg => {
        msg.getInternetIndexOptions = {

            method: 'GET',

            url: 'http://i.babilon-t.tj/internet/index',

            headers: {
                "Host": "i.babilon-t.tj",
                "User-Agent": "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:74.0) Gecko/20100101 Firefox/74.0",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
                "Accept-Encoding": "gzip, deflate",
                "Origin": "http://i.babilon-t.tj",
                "DNT": "1",
                "Connection": "keep-alive",
                "Upgrade-Insecure-Requests": "1",
                "Cookie": msg.cookieStr
            },

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

        }
        const { status, headers, data } = await axios.request(msg.getInternetIndexOptions)
        delete msg.getInternetIndexOptions
        msg.getInternetIndexResponse = { status, headers, data }
        return msg
    },
    // save/remove cookies
    async msg => {
        await lib.processReceivedCookies(msg.getInternetIndexResponse)
        delete msg.cookieStr
        return msg
    },
    // strip headers and footers from the body of the response
    msg => {
        const str = msg.getInternetIndexResponse.data
        const index = str.match(/<body/).index
        const endIndex = str.match(/<\/body>/).index
        const endRegExLength = '</body>'.length
        msg.getInternetIndexResponse.data = str.substring(index, endIndex + endRegExLength)
        return msg
    },
    // remove tabs and new lines
    msg => {
        const str = msg.getInternetIndexResponse.data
        msg.getInternetIndexResponse.data = str.replace(/[\t\n\r]/gi, '')
        return msg
    },
    // extract the <table>'s
    msg => {
        let str = msg.getInternetIndexResponse.data
        str = pullTables(str)
        msg.getInternetIndexResponse.data = str
        return msg
    },
    // divide the tables by <tr> tags
    msg => {
        let arr = msg.getInternetIndexResponse.data
        arr = arr.map(str => pullTrs(str))
        msg.getInternetIndexResponse.data = arr
        return msg
    },
    // flatten arr
    msg => {
        // const flatArr = []
        msg.getInternetIndexResponse.data = msg.getInternetIndexResponse.data.reduce((acc, arr) => ([...acc, ...arr]), [])
        // msg.getInternetIndexResponse.data = flatArr
        return msg
    },
    // divide the tables by <td> tags
    msg => {
        let arr = msg.getInternetIndexResponse.data
        arr = arr.map(str => pullTds(str))
        msg.getInternetIndexResponse.data = arr
        return msg
    },
    // divide strings into key, value pairs
    msg => {
        let arr = msg.getInternetIndexResponse.data
        arr = arr.map(deepArr => mkKV(deepArr))
        msg.getInternetIndexResponse.data = arr
        return msg
    },
    // keep only transformed data
    msg => {
        return { fetch: msg.getInternetIndexResponse.data }
    },
    // remove unwanted key value pairs
    msg => {
        msg.fetch = msg.fetch.filter((_v, i) => i <= 6 && i !== 2)
        return msg
    },
    // translate into english and make str corrections
    msg => {
        const transform = {
            'Лицевой счет': 'accountId',
            'Баланс': 'balance',
            'Текущий <br> тарифный план': 'plan',
            'Оплаченный объем трафика': 'startingAmount',
            'Наработка трафика': 'amountUsed',
            'Остаток оплаченного объема трафика': 'amountRemaining'            
        }
        msg.fetch = msg.fetch.map(kvp => {
            let k = kvp[0]
            let v = kvp[1]
            const keys = Object.keys(transform)
            for (const transformKey of keys) {
                if (k === transformKey) {
                    k = transform[transformKey]
                    delete transform[transformKey]
                    break
                }
            }
            kvp[0] = k
            kvp[1] = v.replace(/[^0-9]/gi,'')
            return kvp
        })
        return msg
    },
    // transform key value pair arrays into obj
    msg => {
        msg.data = msg.fetch.reduce((acc, arr) => ({
            ...acc,
            [arr[0]]: arr[1]
        }), {})
        delete msg.fetch
        msg.data.statusTime = new Date().toString()
        return msg
    },
    // save result in file
    async msg => {
        const fetchPath = lib.getFetchPath()
        await fs.writeFile(fetchPath, JSON.stringify(msg.data, null, 2))
        return msg
    }
)

module.exports = { fetch }