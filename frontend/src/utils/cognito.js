/**
 * utils/cognito.js
 * AWS Cognito authentication using amazon-cognito-identity-js
 */

import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
  CognitoUserAttribute,
} from 'amazon-cognito-identity-js'

const poolData = {
  UserPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID || '',
  ClientId:   import.meta.env.VITE_COGNITO_APP_CLIENT_ID || '',
}

const userPool = new CognitoUserPool(poolData)

// ─── Sign Up ─────────────────────────────────────────────────────────────────
export function signUp(email, password) {
  return new Promise((resolve, reject) => {
    const attrs = [new CognitoUserAttribute({ Name: 'email', Value: email })]
    userPool.signUp(email, password, attrs, null, (err, result) => {
      if (err) return reject(err)
      resolve(result)
    })
  })
}

// ─── Confirm Sign Up ─────────────────────────────────────────────────────────
export function confirmSignUp(email, code) {
  return new Promise((resolve, reject) => {
    const user = new CognitoUser({ Username: email, Pool: userPool })
    user.confirmRegistration(code, true, (err, result) => {
      if (err) return reject(err)
      resolve(result)
    })
  })
}

// ─── Sign In ─────────────────────────────────────────────────────────────────
export function signIn(email, password) {
  return new Promise((resolve, reject) => {
    const user    = new CognitoUser({ Username: email, Pool: userPool })
    const authDet = new AuthenticationDetails({ Username: email, Password: password })

    user.authenticateUser(authDet, {
      onSuccess: (session) => {
        resolve({
          idToken:      session.getIdToken().getJwtToken(),
          accessToken:  session.getAccessToken().getJwtToken(),
          refreshToken: session.getRefreshToken().getToken(),
          user,
        })
      },
      onFailure: reject,
    })
  })
}

// ─── Sign Out ────────────────────────────────────────────────────────────────
export function signOut() {
  const user = userPool.getCurrentUser()
  if (user) user.signOut()
}

// ─── Get Current Session ─────────────────────────────────────────────────────
export function getCurrentSession() {
  return new Promise((resolve, reject) => {
    const user = userPool.getCurrentUser()
    if (!user) return resolve(null)
    user.getSession((err, session) => {
      if (err || !session.isValid()) return resolve(null)
      resolve({
        idToken:     session.getIdToken().getJwtToken(),
        accessToken: session.getAccessToken().getJwtToken(),
        userId:      session.getIdToken().payload.sub,
        email:       session.getIdToken().payload.email,
      })
    })
  })
}
