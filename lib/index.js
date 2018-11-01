const xml2js = require('xml2js');
const assert = require('assert');
const pathToRegExp = require('path-to-regexp');
const authenticate = require('./authenticate');
const validate = require('./validate');
const slo = require('./slo');
const utils = require('./utils');
const _ = require('lodash');







const DEFAULT_OPTIONS = {
    ignore: [],
    match: [],
    clientOrigin: '',
    serverOrigin: '',
    paths: {
        clientValidate: '/cas/validate',
        serverValidate: '/serviceValidate',
        login: '/login',
        logout: '/logout',
    },
    hasSlo: true,
    fromAjax: {
        header: 'X-Requested-With',
        status: 200,
    },
};

class Cas {
    constructor(options) {
        this.options = _.merge({}, DEFAULT_OPTIONS, options);
    }
    core() {
        const options = this.options;
        const {
            paths,
            hasSlo,
        } = options;
        const {
            clientValidate,
            login,
        } = paths;

        return async (ctx, next) => {
            const {
                method,
                path,
            } = ctx;

            ctx.logger.info('protocol: %s', ctx.protocol);
            ctx.logger.info('url: %s', ctx.href)

            /**
             * 通过st查询当前session 是否在 casList 中，
             * 不存在就删除当前session
             */
            if (ctx.session) {
                console.log('ctx.session.............', JSON.stringify(ctx.session));
            }

            if (ctx.app.casList && ctx.session && ctx.session.cas && ctx.session.cas.st) {
                const data = await ctx.app.redis.get(ctx.session.cas.st);
                if (data) {
                    ctx.logger.info(`session  from redis by st ${ctx.session.cas.st}: ${data}`);
                }
                if (!data) {
                    ctx.logger.info('delete session when no st in redis %s', ctx.session.cas.st);
                    ctx.session = null;
                }
            }


            /**
             * shouldIgnore
             */
            if (utils.shouldIgnore(ctx, options)) {
                return await next();
            }
            if (method === 'GET') {
                switch (path) {
                    case clientValidate:
                        return await validate(ctx, options);
                    default:
                        break;
                }
            }
            /**
             * 单点登出
             */
            else if (method === 'POST' && path === clientValidate && hasSlo) {
                return await slo(ctx, options);
            }
            return await authenticate(ctx, next, options);
        }
    }
    logout() {
        const options = this.options;
        return async (ctx) => {
            if (!ctx.session) {
                return ctx.redirect('/');
            }
            if (ctx.app.casList && ctx.session && ctx.session.cas && ctx.session.cas.st) {
                delete ctx.app.casList[ctx.session.cas.st];
            }
            ctx.session = null;
            // Send the user to the official campus-wide logout URL
            return ctx.redirect(utils.getPath('logout', options, ctx));
        }
    }
    login() {
        return async (ctx) => {
            let {
                service,
            } = ctx.query;
            ctx.logger.info('Has Session st, go to login router');
            if (service) {
                ctx.logger.info('login with service , redirect to %s', service);
                return ctx.redirect(service);
            }
            ctx.logger.info('login without service , redirect to /');
            return ctx.redirect('/');
        }
    }
}

module.exports = Cas;