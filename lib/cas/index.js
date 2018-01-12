const xml2js = require('xml2js');
const assert = require('assert');
const pathToRegExp = require('path-to-regexp');

/**
 * xml2JsParseString
 * @param {XML} xml 
 * @param {Object} options 
 * @returns {Promise}
 */
const xml2JsParseString = async (xml, options, ) => {
    options = {
        /*  Always put child nodes in an array if true; otherwise an array is created only if there is more than one. */
        explicitArray: false,
        /* Ignore all XML attributes and only create text nodes */
        ignoreAttrs: true,
        ...options,
    };
    return new Promise((resolve) => {
        xml2js.parseString(xml, options, (err, result) => {
            if (err) {
                return reslove(false);
            }
            return resolve(result);
        });
    });
}



/**
 * isLogut filter
 * @param {KOA-CONTEXT} ctx 
 * @returns {Boolean | String}
 */
const isLogout = async (ctx) => {
    const {
        method,
        body,
    } = ctx.request;
    if (method === 'POST' && body && body.logoutRequest) {
        const xml = await xml2JsParseString(body.logoutRequest);
        if (xml['samlp:LogoutRequest'] && xml['samlp:LogoutRequest']['samlp:SessionIndex']) {
            return xml['samlp:LogoutRequest']['samlp:SessionIndex'];
        }
        return false;
    }
    return false;
}


/**
 * delete current user in "userList" of ctx.app
 * @param {KOA-CONTEXT} ctx 
 * @param {CAS-TGT<string>} ticket 
 */
const deleteUserlist = (ctx, ticket) => {
    const {
        userList,
    } = ctx.app;
    if (userList && Object.prototype.hasOwnProperty.call(userList, ticket)) {
        /**
         * logger info
         */
        ctx.logger.info('user log out, data: %j', {
            ticket,
            user: userList[ticket]
        });

        /**
         * delete current user in "userList" of ctx.app
         */
        delete userList[ticket];

        /**
         * logger info
         */
        ctx.logger.info('after user log out, userList data: %j', ctx.app.userList);
    }
}

/**
 * add current user to "userList" of ctx.app
 * @param {KOA-CONTEXT} ctx
 * @param {CAS-TICKET} ticket 
 * @param {Object} user 
 */
const addUserList = (ctx, ticket, user) => {
    const {
        userList = {},
    } = ctx.app;
    if (userList && !Object.prototype.hasOwnProperty.call(userList, ticket)) {
        userList[ticket] = user;
    }
    /**
     * logger info
     */
    ctx.logger.info('user log in, data: %j', {
        ticket,
        user,
    });

    ctx.app.userList = userList;

    /**
     * logger info
     */
    ctx.logger.info('after user log in, userList data: %j', ctx.app.userList);
}



class Cas {
    constructor(options) {
        const {
            casService,
            path,
        } = options;
        assert(casService, 'expect param "casService"');
        assert(path, 'expect param "path"');
        assert(path.casServiceValidate, 'expect param "path.casServiceValidate"');
        this.options = options;
    }
    login() {
        return async (ctx, next) => {
            try {
                const {
                    casService,
                    match,
                } = this.options;
                const casPath =  this.options.path;
                
                const {
                    query,
                    origin,
                    path,
                    session,
                    request,
                    app,
                } = ctx;
                pathToRegExp([
                    '/api/permission/*',
                ]).test(ctx.path);
                if(!match(ctx)) {
                    return await next();
                }
                /**
                 * isLogin
                 */
                if (session.user && session.user.ticket && app.userList && Object.prototype.hasOwnProperty.call(app.userList, session.user.ticket)) {
                    return await next();
                }
    
    
    
    
                /**
                 * get origin url without query 'ticket'
                 */
                let search = [];
                for (let key in query) {
                    if (key === 'ticket') {
                        continue;
                    }
                    search.push(`${key}=${query[key]}`)
                }
                const href = `${origin}${path}${search.length > 0 ? `?${search.join('&')}` : ''}`;
    
    
                /**
                 * filter cas ticket
                 */
                if (Object.prototype.hasOwnProperty.call(query, 'ticket')) {
                    const ticket = query.ticket;
    
                    /**
                     * validate ticket
                     */
                    const respone = await ctx.curl(`${casService}${casPath.casServiceValidate}?ticket=${ticket}&service=${encodeURIComponent(href)}`);
                    console.log(respone)
                    if (respone.status === 200) {
    
                        /**
                         * parse xml 
                         */
                        const xml = await xml2JsParseString(respone.data.toString());
                        if (xml && xml['cas:serviceResponse'] && xml['cas:serviceResponse']['cas:authenticationSuccess']) {
    
                            /**
                             * get user
                             */
                            const user = JSON.parse(decodeURIComponent(xml['cas:serviceResponse']['cas:authenticationSuccess']['cas:attributes']['cas:userInfo']))
    
    
                            /**
                             * add user to session
                             */
                            session.user = {
                                ticket,
                                user,
                            }
    
                            /**
                             * add current user to "userList" of ctx.app
                             */
                            addUserList(ctx, ticket, user);
    
    
                            /**
                             * redirect origin url
                             */
                            return ctx.redirect(href);
                        }
                    }
                }
                else {
                    /**
                     * redirect cas-server
                     */
                    return ctx.redirect(`${casService}?service=${encodeURIComponent(href)}`)
                }
            } catch (error) {
                throw new Error(`${error} in cas.login` );
            }
            await next();
        }
    }
    logout() {
        return async (ctx, next) => {
            const {
                ajax,
            } = this.options;
            const sessionIndex = await isLogout(ctx);
            console.log(sessionIndex)
            if (sessionIndex) {
                deleteUserlist(ctx, sessionIndex); 
                
                /**
                 * from ajax
                 */
                if(ajax && ajax['X-Requested-With'] && ctx.get(ajax['X-Requested-With']) &&  ajax['X-Requested-With'].indexOf(ctx.get(ajax['X-Requested-With'])) > -1) {
                    ctx.status = ajax.status || 401;
                    return ctx.body = {
                        status: ajax.dataStatus || -1,
                        message: ajax.message || 'login timeout',
                    }
                }
            }
            await next();
        }
    }
}

module.exports = Cas;