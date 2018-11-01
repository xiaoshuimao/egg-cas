const queryString = require('query-string');
const utils = require('./utils');

const REG_TICKET = /^ST-[\w\d_\-.]+$/;

/*
 * Validate ticket from CAS server
 *
 * @param ctx
 * @param options
 */
const validateTicket = async (ctx, options) => {
	const query = {
		service: encodeURIComponent(utils.getPath('client', options)),
		ticket: ctx.query.ticket,
	};
	const {
		logger,
	} = ctx;
	const serverValidateUrl = `${utils.getPath('serverValidate', options)}?${queryString.stringify(query, {encode: false})}`;

	logger.info(`Sending request to serverValidateUrl "${serverValidateUrl}" to validate ticket.`);
	try {
		const response = await ctx.curl(serverValidateUrl);
		logger.info(`Response status from serverValidateUrl "${serverValidateUrl}" %d `, response.status);
		return response;
	} catch (error) {

		logger.info(`Response status from serverValidateUrl "${serverValidateUrl}" %d `, 500);
		logger.error('Error when sending request to CAS server, error: ', error.toString());
		throw error;
	}
}







/*
 * Validate a ticket from CAS server
 *
 * @param ctx
 * @param afterHook
 * @param options
 */
const validate = async (ctx, options) => {
	const ticket = (ctx.query && ctx.query.ticket) || null;
	const {
		logger,
		session,
	} = ctx;
	let lastUrl = utils.getLastUrl(ctx, options);
	logger.info('Start validating ticket...');

	/**
	 * no ticket
	 */
	if(!ticket) {
		logger.warn(`Can\' find ticket in query, redirect to last url: ${lastUrl}`);
		utils.deleteLastUrl(ctx);
		return ctx.redirect(lastUrl);
	}

	/**
	 * ticket is invalid
	 */
	if (!ticket.match(REG_TICKET)) {
		logger.warn(`Ticket '${ticket}' is invalid, validate failed!`);
		ctx.status = 400;
		ctx.body = `Ticket is invalid, validate failed!`;
		return;
	}


	logger.info('Found ticket in query', ticket);


	/**
	 * session has this ticket
	 */
	if(session && session.cas && session.cas.st === ticket) {
		logger.info(`Ticket in query is equal to the one in session, go last url: ${lastUrl}`);
		utils.deleteLastUrl(ctx);
		return ctx.redirect(lastUrl);
	}


	/**
	 * try to validate ticket from cas server
	 */
	try {
		const response = await validateTicket(ctx, options);
		/**
		 * status is not "200"
		 */
		if (response.status !== 200) {
			logger.error(`Receive response from cas when validating ticket, but request failed with status code: ${response.status}!`);
			ctx.status = 401;
			ctx.body = {
				message: `Receive response from cas when validating ticket, but request failed with status code: ${response.status}.`,
			};
			return;
		}
		try {
			const info = await utils.xml2JsParseString(response.data);
			if (info && info['cas:serviceResponse'] && info['cas:serviceResponse']['cas:authenticationSuccess']) {
    
				/**
				 * get user
				 */
				const user = JSON.parse(decodeURIComponent(info['cas:serviceResponse']['cas:authenticationSuccess']['cas:attributes']['cas:userInfo']));
				session.cas = {
					info,
					st: ticket,
					user,
				}
				
				// session.cas = info;
				// session.cas.st = ticket;
				// session.cas.user = user;

				/**
				 * if hasSlo
				 * link current session to ctx.app.casList
				 */
				if(options.hasSlo) {
					utils.addSessionToRedis(ctx, ticket);
				}
				
				utils.deleteLastUrl(ctx);
				return ctx.redirect(lastUrl);
			}
			else {
				ctx.status = 401;
				ctx.body = {
					message: 'Receive response from CAS when validating ticket, but the validation is failed.',
				};
				return;
			}
		} catch (error) {
			const body = {
				error: error,
				message: error.message,
			};
			ctx.status = 500;
			ctx.body = body;
			return
		}
	} catch (error) {
		ctx.status = 500;
		ctx.body = {
			message: 'Receive response from cas when validating ticket, but request failed because an error happened.',
			error: error.message,
		};
	}






}


module.exports = validate;
