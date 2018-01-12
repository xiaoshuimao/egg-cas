const Cas = require('./lib/cas')
module.exports = async (app) => {
    const config = app.config.cas;
    app.cas = new Cas(config);
    app.config.coreMiddleware.push('casLogout');
    app.config.coreMiddleware.push('casLogin');
}

