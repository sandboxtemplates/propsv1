import { SUPABASE, deleteJwtToken, getJwtToken, getUserIdFromToken, setJwtToken } from "./auth";
import randomstring from "randomstring"
import emailjs from "@emailjs/browser"
const bcrypt = require('bcryptjs')


export const state = () => ({
    jwtUser: getJwtToken(),
    userData: null,
    resetCode: null,
})

export const getters = {
}

export const mutations = {
    setUserFromJwt(state, data) {
        state.jwtUser = data
    },

    setUserData(state, data) {
        state.userData = data
    },

    setResetCode(state, data) {
        state.resetCode = data
    }
}

export const actions = {
    async signup({ dispatch }, { user }) {
        const { data, error, status } = await SUPABASE.rpc('signup', {
            firstname: user.firstname,
            lastname: user.lastname,
            email: user.email,
            password: await encryptPassword(user.password)
        })
        if (status === 204) {
            await dispatch('login', { user: user })
        } else if (status === 409) {
            alert('An account already exists with that email.')
        } else {
            if (error) {
                console.log(err)
            }
        }
    },

    async getUser({}, { email }) {
        const { data, error, status } = await SUPABASE.from('user')
            .select()
            .eq('email', email)
        return data
    },

    async login({ commit, dispatch }, { user }) {
        const res = await dispatch('getUser', { email: user.email })
        if (res.length > 0) {
            if (await matchPassword(user.password, res[0].password)) {
                const { data, error, status } = await SUPABASE.rpc('login', {
                    email: user.email,
                    password: res[0].password
                })
                if (data.token !== null) {
                    setJwtToken(data.token)
                    await commit('setUserFromJwt', getUserIdFromToken(getJwtToken()))
                    this.$router.push('/')
                }
            } else {
                alert('The password you provided is incorrect.')
            }
        } else if (res.length === 0) {
            alert('No account was found with that email.')
        }
    },

    async getCurrentUser({ commit, state }) {
        const { data, error, status } = await SUPABASE.from('get_user_data')
            .select()
            .eq('email', state.jwtUser.email)
        if (status === 200) {
            await commit('setUserData', data[0])
        } else {
            console.log(error)
        }
    },

    async signOut({ commit }) {
        deleteJwtToken()
        await commit('setUserFromJwt', null)
        this.$router.push('/login')
    },

    async getPassResetCode({ commit, dispatch }, { email, code = randomstring.generate(6) }) {
        const res = await dispatch('getUser', { email: email })
        if (res.length > 0) {
            const fifteenMin = 900000
            const expiration = Date.now() + fifteenMin
            const { data, error, status } = await SUPABASE.from('reset_code')
                .insert({
                    code: code,
                    codeemail: email,
                    codeexpiration: expiration.toString()
                }).select()
            console.log(data, error, status)
            if (status === 201) {
                const params = {
                    to_name: res[0].firstname,
                    to_email: email,
                    code: code,
                    codeexpiration: new Date(expiration)
                }
                emailjs.send('mmq_gmail_service', 'template_kbqejnl', params, 'rWfLyPQyBNY3WqQSS')
                .then(async function(response) {
                    alert(`Check your email and enter the code in the space below. The code will expire in 15 minutes.`)
                    await commit('setResetCode', data[0])
                }, function(err) {
                    console.log('FAILED...', err);
                });
            } else if (status === 409) {
                await dispatch('getPassResetCode', { email: email })
            }
        } else if (res.length === 0) {
            alert('No account found with that email.')
        }
    },

    async resetPass({}, { email, password }) {
        const { data, error, status } = await SUPABASE.from('user')
            .update({
                password: await encryptPassword(password)
            })
            .eq('email', email)
        if (status === 204) {
            alert('Password reset successful.')
        } else alert('Something went wrong, please try again.')
    },

    async updateAvatar({ commit }, { userid, avatar }) {
        const { data, error, status } = await SUPABASE.from('user')
            .update({
                avatar: avatar
            })
            .eq('userid', userid)
            .select()
        if (status === 204 || status === 200) {
            alert('Profile photo successfully updated.')
            await commit('setUserData', data[0])
        } else alert('Something went wrong, please try again.')
    }
}


/// FUNCTIONS
async function getUser() {
    // const { data: { user } } = await supabase.auth.getUser()
    // console.log(`GET USER: ${user}`)
    // return user
}

async function encryptPassword (password) {
    const salt = await bcrypt.genSalt(10)
    return await bcrypt.hash(password, salt)
}

export async function matchPassword(givenPass, accountPass) {
    const match = await bcrypt.compare(givenPass, accountPass)
    return match
}
