const qs = require('query-string');
const url = require('url');
const xml2js = require('xml2js');
const pathToRegExp = require('path-to-regexp');

/*
 * 获取去掉ticket参数后的完整路径
 *
 * @param ctx
 * @param options
 * @returns {string}
 */
const getOrigin = (ctx, options) => {
	const query = ctx.query;
	if (query.ticket) delete query.ticket;
	const querystring = qs.stringify(query);
	if (!options) {
		throw new Error('no options!!!');
	}
	ctx.logger.info('getOrigin %s', options.clientOrigin)
	return options.clientOrigin + ctx.path + (querystring ? `?${querystring}` : '');
}


const setLastUrl = (ctx, options) => {
	const query = ctx.query;
	if(ctx.session) {
		if(query.service) {
			ctx.logger.info('setLastUrl:  query is %j', query)
			ctx.session.lastUrl = query.service;
		}
		else {
			const url = getOrigin(ctx, options);
			ctx.session.lastUrl = url;
		}
	}
}

const deleteLastUrl = (ctx, options) => {
	if(ctx && ctx.session && ctx.session.lastUrl) {
		delete ctx.session.lastUrl;
	}
}

/**
 * lastUrl
 * @param {*} ctx 
 * @param {*} options 
 */
const getLastUrl = (ctx, options) => {
	let lastUrl = (ctx.session && ctx.session.lastUrl) ? ctx.session.lastUrl : '/';

	const uri = url.parse(lastUrl, true);
	const {
		query = { },
	} = uri;
	const {
		service,
	} = query;
	if(service) {
		if(service === options.paths.clientValidate) {
			lastUrl = '/'
		}
		else {
			lastUrl = service;
		}
		ctx.logger.info(`Get lastUrl: ${lastUrl}`);
		return lastUrl;
	}
	if (uri.pathname === options.paths.clientValidate) lastUrl = '/';

	ctx.logger.info(`Get lastUrl: ${lastUrl}`);

	return lastUrl;
}



/**
 * 获取配置好的对应path
 * @param {*} name 
 * @param {*} options 
 */
const getPath = (name, options, ctx) => {
	if (!name || !options) return '';
	let path = '';

	const {
		serverOrigin,
		clientOrigin,
		paths,
	} = options;

	
	const {
		login,
		logout,
		clientValidate,
		serverValidate,
	} = paths;
	switch (name) {
		case 'login':
			path = `${serverOrigin + login}?service=${encodeURIComponent(clientOrigin + clientValidate)}`;
			break;
		case 'logout':
			if(ctx && ctx.query && ctx.query.service) {
				path = `${serverOrigin + logout}?service=${encodeURIComponent(ctx.query.service)}`;
			}
			else {
				path = `${serverOrigin + logout}?service=${encodeURIComponent(clientOrigin + clientValidate)}`;
			}
			break;
		case 'serverValidate':
			path = serverOrigin + serverValidate;
			break;
		case 'client':
		case 'clientValidate':
			path = clientOrigin + clientValidate;
			break;
		default:
			throw new Error(`utils.getPath argv name = ${name} is not support`);
	}
	return path;
}

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
 * link current session to "casList" of ctx.app
 * @param {KOA-CONTEXT} ctx
 * @param {CAS-TICKET} ticket 
 * @param {Object} session 
 */
const addSessionToRedis = async (ctx, ticket) => {
    const {
        casList = {},
    } = ctx.app;
    // if (casList && !Object.prototype.hasOwnProperty.call(casList, ticket)) {
    //     casList[ticket] = ctx.session;
	// }
	try {
		if(ticket) {
			const data = await ctx.app.redis.set(ticket, JSON.stringify(ctx.session))
			ctx.logger.info('save session in to redis by st %d whit result %s', ticket, data);
		}
	} catch (error) {
		ctx.logger.error(error);
	}

    ctx.app.casList = casList;

    /**
     * logger info
     */
    ctx.logger.info('ctx.app.casList data: %j', ctx.app.casList);
}

/*
 * Check options.match first, if match, return `false`, then check the options.ignore, if match, return `true`.
 * @param ctx
 * @param options
 */
const shouldIgnore = (ctx, options) => {
	const path = ctx.path;
	const {
		match,
		ignore,
	} = options;
	const paths = options.paths;

	/**
	 * default match
	 * /cas/validate
	 * /login
	 */
	const defaultMatch = [paths.clientValidate, paths.login];
	if(pathToRegExp(defaultMatch).test(path)) {
		return false;
	}
	
	if(match) {
		switch(Object.prototype.toString.call(match)) {
			case '[object RegExp]': {
				return !match.test(path);
			}
			case '[object String]': {
				return match !== path;
			}
			case '[object Array]': {
				if(match.length <= 0) {
					return true;
				}
				return !pathToRegExp(match).test(path);
			}
		}
		return true;
	}
	if(ignore) {
		switch(Object.prototype.toString.call(ignore)) {
			case '[object RegExp]': {
				return ignore.test(path);
			}
			case '[object String]': {
				return ignore == path;
			}
			case '[object Array]': {
				return pathToRegExp(ignore).test(path);
			}
		}
		return false;
	}
}


module.exports = {
	getOrigin,
	getPath,
	getLastUrl,
	setLastUrl,
	deleteLastUrl,
	xml2JsParseString,
	addSessionToRedis,
	shouldIgnore,
}