const Cas = require('./lib/index')
module.exports = async (app) => {
    const config = app.config.cas;
    app.cas = new Cas(config);
    app.config.coreMiddleware.push('casCore');
    // app.config.coreMiddleware.push('casLogin');
}

