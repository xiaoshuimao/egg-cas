# egg-cas

### config.default.js

```js
  config.cas = {
		ignore: [], //忽略地址， 优先级比match低
		match: [], //需要匹配的地址
		clientOrigin: '', //单点客户端服务器域名， 比如httsp://127.0.0.1:8080
		serverOrigin: '', //单点中心服务器域名， 比如https://www.casserver.com
		paths: {
			clientValidate: '/cas/validate', //单点客户端对单点服务器输出的servicer地址参数，例如`${serverOrigin + login}?service=${encodeURIComponent(clientOrigin + clientValidate)}`
			serverValidate: '/serviceValidate', //单点服务器验证票据Ticket的路径
			login: '/login', //登陆路径
			logout: '/logout', //登出路径
		},
		fromAjax: {
			header: 'X-Requested-With', 
			status: 200,
		},
};
```

### plugin.js

```js
exports.cas = {
  enable: true,
  package: 'egg-cas'
}
```


### router

```js
  //logout
  router.get('/logout', app.cas.logout());

  //login
  router.get('/login', app.cas.login());

```
