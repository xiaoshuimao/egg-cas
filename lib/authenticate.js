const utils = require('./utils');


const authenticate = async (ctx, next, options) => {
    ctx.logger.info('Doing cas authenticating...');

    /**
     * check st in session 
     */
    if(ctx.session && ctx.session.cas && ctx.session.cas.st) {
        ctx.logger.info('Find st in session');
        return await next();
    }

    ctx.logger.info('Can not find st in session: ', ctx.session);

    /**
     * remark lastUrl
     */
    utils.setLastUrl(ctx, options);

    /**
     * fromAjax
     */
    if (options.fromAjax && options.fromAjax.header && ctx.get(options.fromAjax.header)) {
		ctx.logger.info(`Need to redirect, but matched AJAX request, send ${options.fromAjax.status}`);
		ctx.status = options.fromAjax.status;
		ctx.body = {
            status: -1,
            msg: '登录失效, 请重新登录',
			message: '登录失效, 请重新登录',
		};
		return;
	}
    /**
     * redirect to login page
     */
    const loginPath = utils.getPath('login', options);
    ctx.logger.info('redirect to login page ', loginPath);
	ctx.redirect(loginPath);

};

module.exports = authenticate;