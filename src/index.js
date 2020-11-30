#!/usr/bin/env node
const { fetch } = require('./fetch')
const { status } = require('./status')
const { renew } = require('./renew')
const { auth } = require('./auth')
const lib = require('./lib')

const pullCMD = _argv => fetch()
const statusCMD = _argv => status()
const renewCMD = argv => {
  // console.log(lib.parseRenewOptions(argv))
  renew(lib.parseRenewOptions(argv))
}
const renewOptions = function (yargs) {
  yargs
    .positional('plan', {
      type: 'string',
      describe: 'The EVO plan to buy from'
    })
    .option('schedule', {
      alias: 's',
      default: false,
      type: 'boolean'
    })
}
const loginCMD = _argv => auth()

require('yargs')
  .scriptName("babilon")
  .usage('$0 <cmd> [args]')
  .command('pull', 'Reads the status from babilon-t.tj into a file', pullCMD)
  .command('status', 'Reads the status from file', statusCMD)
  .command('renew <plan>', 'Buys more data from babilon', renewOptions, renewCMD)
  .command('login', 'Login to i.babilon-t.tj', loginCMD)
  .help()
  .argv
