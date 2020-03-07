'use strict'

const DOMAIN = 'a.roguetrader.com'
const AUTHX_BASE = '/authx/v1/api'
const VALIDATION = {} // copy validation from your profile->APIKey page
const request = require('request')
const jwt = require('jsonwebtoken')
const uuid = require('uuid')

/* ********************************************************************** */
// create your own JWT as a signin (aka refresh token) using our shared secret
// Sign using the HS256 algorithm.
const refreshToken = jwt.sign(
  { jti: uuid.v4(), sub: VALIDATION.sub, aud: VALIDATION.aud },
  VALIDATION.sec,
  { expiresIn: 15 * 60 }
)

console.log(`Refresh Token: ${refreshToken}\n`)

/* ********************************************************************** */
// then get your session / access token
console.log(`Signin at: https://${DOMAIN}${AUTHX_BASE}/refresh\n`)
let accessToken = ''
request.post(
  `https://${DOMAIN}${AUTHX_BASE}/refresh`,
  {
    form: {
      client_assertion_type:
        'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
      client_assertion: refreshToken
    }
  },
  (err, res, body) => {
    if (err) {
      return console.error(err)
    }
    if (res.statusCode != 200) {
      throw Error('Auth Failed')
    }
    const accessToken = JSON.parse(body).access_token
    console.log(`Access Token: ${accessToken}\n`)

    /* ********************************************************************** */
    // now do something
  }
)
