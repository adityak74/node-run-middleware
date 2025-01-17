var _ = require("lodash");

var request = require("express/lib/request");

function isPlainObject(obj) {
    return  typeof obj === 'object' // separate from primitives
        && obj !== null         // is obvious
        && obj.constructor === Object // separate instances (Array, DOM, ...)
        && Object.prototype.toString.call(obj) === '[object Object]'; // separate build-in like Math
}

module.exports = function(app) {
  app.use((req, res, next) => {
    req.runMiddleware = (path, options, callback) => {
      if (_.isFunction(options)) {
        callback = options;
        options = {};
      }
      options.original_req = req;
      options.original_res = res;
      app.runMiddleware(path, options, callback);
    };
    next();
  });
  if (app.runMiddleware) return; // Do not able to add us twice

  app.runMiddleware = function(path, options, callback) {
    if (callback) callback = _.once(callback);
    if (typeof options == "function") {
      callback = options;
      options = null;
    }
    options = options || {};
    options.url = path;
    var new_req, new_res;
    if (options.original_req) {
      new_req = options.original_req;
      for (var i in options) {
        if (i == "original_req") continue;
        new_req[i] = options[i];
      }
    } else {
      new_req = createReq(path, options);
    }
    new_res = createRes(callback);
    app(new_req, new_res);
  };

  /* end - APP.runMiddleware*/
};

function createReq(path, options) {
  if (!options) options = {};
  var req = _.extend(
    {
      method: "GET",
      host: "",
      cookies: {},
      query: {},
      url: path,
      headers: {},
    },
    options
  );
  req.method = req.method.toUpperCase();
  // req.connection=_req.connection
  return req;
}
function createRes(callback) {
  var res = {
    _removedHeader: {},
  };
  res = _.extend(res, require('express/lib/response'));

  var headers = {};
  var code = 200;
  res.set = res.header = (x, y) => {
    if (isPlainObject(x)) {
      for (var key in x) {
        res.setHeader(key, x[key]);
      }      
    } else if(typeof x === 'string') {
      res.setHeader(x, y);
    }
    return res;
  }
  res.setHeader = (x, y) => {
    headers[x] = y;
    return res;
  };
  res.removeHeader = (x) => {
    res._removedHeader[x] = headers[x];
    delete headers[x];
  }
  res.get = res.getHeader = (x) => headers[x];
  
  res.redirect = function(_code, url) {
    if (!_.isNumber(_code)) {
      code = 301;
      url = _code;
    } else {
      code = _code;
    }
    res.setHeader("Location", url);
    res.end();
    // callback(code,url)
  };
  res.status = function(number) {
    code = number;
    return res;
  };
  res.end = res.send = res.write = function(data) {
    if (callback) callback(code, data, headers);
    // else if (!options.quiet){
    //     _res.send(data)
    // }
  };
  return res;
}
