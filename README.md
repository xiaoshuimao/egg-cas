# egg-cas

### config.default.js

```js
config.cas = {
    match: (ctx) => pathToRegExp([
      '/api/permission/*',
    ]).test(ctx.path),
    casService: 'http://172.16.14.25:8080',
    path: {
      casServiceValidate: '/serviceValidate',
    },
    ajax: {
      'X-Requested-With': ['XMLHttpRequest'],
      status: 401,
      dataStatus: -1,
    }
  }
```

### plugin.js

```js
exports.cas = {
  enable: true,
  path: path.join(__dirname, '../lib/plugin/egg-cas')
}
```
