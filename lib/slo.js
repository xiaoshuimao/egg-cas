const utils = require('./utils');


const slo = async (ctx, options) => {
    ctx.logger.info('Doing slo...');
    const {
        method,
        body,
    } = ctx.request;

    ctx.logger.info(`receive slo POSt............., ${body.logoutRequest}`);
    if (method === 'POST' && body && body.logoutRequest) {
        try {
            const xml = await utils.xml2JsParseString(body.logoutRequest);
            ctx.logger.info('Receive slo request... Trying to logout. body=', xml);
            if (xml['samlp:LogoutRequest'] && xml['samlp:LogoutRequest']['samlp:SessionIndex']) {
                ctx.status = 200;
                const ticket = xml['samlp:LogoutRequest']['samlp:SessionIndex'];

                ctx.logger.info(`slo ticket............., ${ticket}`);
                ctx.logger.info(`options.hasSlo........`, `${options.hasSlo}`);
                /**
                 * if hasSlo
                 * clear session by ctx.app.casList
                 */
                if(options.hasSlo && ticket) {
                    const data = await ctx.app.redis.del(ticket);
                    ctx.logger.info(`delete redis by ticket.........., ${ticket}`);
                }
                return;
            }
        } catch (error) {
            ctx.body = {
                error,
                message: error.message,
            }
            ctx.status = 500;
            return;
        }
       
    }

};

module.exports = slo;