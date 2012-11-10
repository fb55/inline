var http = require("http"),
	https = require("https"),
	url = require("url");

module.exports = function(options, cb){
	if(typeof options === "string"){
		options = { uri: url.parse(options) };
	}
	return new Request(options, cb);
};

//Add methods for the most common cases
["GET", "POST", "HEAD", "DELETE", "UPDATE"].forEach(function(method){
	module.exports[method.toLowerCase()] = function(uri, cb){
		uri = url.parse(uri);
		uri.method = method;
		return new Request({ uri: uri }, cb);
	};
});

var protocols = {
	"http:": http,
	"https:": https
};
module.exports.addProtocol = function(name, module){
	protocols[name] = module;
};

var re_protocol = /^https?:/; //TODO: what about other protocols?

var Request = function(options, cb){
	this._options = options;
	this._cb = cb;

	this._ended = false;
	this._redirected = 0;
	this._resp = null;
	this.response = null;
	this._body = new Buffer(0);


	if(typeof options.uri === "string"){
		options.uri = url.parse(options.uri);
	} else if(typeof options.uri !== "object"){
		this.emit("error", Error("No URI specified!"));
		return;
	}

	//fix for node < 0.5
	if( !("path" in options.uri) ) options.uri.path = options.uri.pathname;

	this.writable = options.uri.method === "POST" || options.uri.method === "PUT";

	this._addListeners();

	if( !(options.uri.protocol in protocols) ){
		this.emit("error", Error("Unknown protocol: " + options.uri.protocol));
		return;
	}

	var scope = this;
	process.nextTick(function(){
		if(!scope._createRequest(options)) return;
		if(!scope.writable) scope._request.end();
		else{
			if(options.body) scope._request.write(options.body);
			scope._prepareClose();
		}
	});
};

var Stream = require("stream").Stream;
require("util").inherits(Request, Stream);

Request.prototype.readable = true;

//save the pipe function for later
var pipe = Stream.prototype.pipe;

Request.prototype.pipe = function(dest, opts){
	if(this._body){
		throw Error("Data was already emitted!");
	}
	else if(this._ended){
		throw Error("Request is closed!");
	}
	
	return pipe.call(this, dest, opts);
};

Request.prototype._prepareClose = function(){
	this._close = true;
	var scope = this;
	process.nextTick(function(){
		if(scope._close){
			scope._request.end();
			scope.writable = false;
		}
	});
};

Request.prototype._addListeners = function(){
	var scope = this;

	this.on("error", function(err){
		if(scope._cb) scope._cb(err);
		scope._cb = null; //remove the cb
	});

	this.on("end", function(){
		scope._ended = true;
	});

	if(this._cb){
		this.on("data", function(chunk){
			scope._body = Buffer.concat([scope._body, chunk]);
		});
		this.on("end", function(){
			scope._cb(null, scope.response, scope._body);
		});
	}

	this.on("redirect", function(location){
		var options = scope._options,
			method = options.uri.method;

		if(scope._redirected++ < (options.maxRedirects || 10)){
			if(!re_protocol.test(location)){
				location = url.resolve(options.uri, location);
			}

			options.uri = url.parse(location);
			options.uri.method = method;

			scope._createRequest(options);
			scope._request.end();
		} else {
			scope.emit("error", Error("Too many redirects"));
		 }
	});

	this.once("pipe", function(src){
		if(!scope.writable){
			scope.emit("error", Error("Can't write to socket!"));
			return;
		}

		 scope._close = false;
		 var cb = function(){
			scope._prepareClose();
		 };
		 src.on("end", cb);
		 src.on("close", cb);

		 scope.on("pipe", function(){
			throw Error("There is already a pipe");
		 });
	});
};

Request.prototype._createRequest = function(options){
	var req = protocols[options.uri.protocol],
	    scope = this;

	this._request = req.request(options.uri, function(resp){
		var statusCode = resp.statusCode;
		
		if( (!("followRedirect" in options) || options.followRedirect) && (statusCode % 300 < 99) && !scope.writable && resp.headers.location){
				clearTimeout(scope._reqTimeout);
				scope.abort(); //close the socket
				scope.emit("redirect", resp.headers.location);
				return;
		}
		
		if(options.only2xx && (statusCode < 200 || statusCode >= 300)){
			scope.emit("error", Error("Received status code " + statusCode + " (\"" + http.STATUS_CODES[statusCode] + "\")"));
			scope.abort();
		}

		//add some info to the scope
		scope.response = {
			location: url.format(options.uri),
			statusCode: statusCode,
			headers: resp.headers
		};

		scope._resp = resp;

		if(options.encoding){
			resp.setEncoding(options.encoding);
		}

		resp.on("end", function(){
			if(!scope._ended) scope.emit("end");
		}).on("close", function(){
			scope.emit("close");
		}).on("error", function(err){
			scope.emit("error", err);
		}).on("data", function(chunk){
			scope.emit("data", chunk);
		});

		scope.emit("response", resp);
	});

	this._request.on("error", function(err){
		scope.emit("error", err);
	});

	if(this._options.headers){
		for(var header in this._options.headers){
			this._request.setHeader(header, this._options.headers[header]);
		}
	}

	if(!("timeout" in options) || options.timeout){
		this._reqTimeout = setTimeout(function(){
			if(!scope._ended){
				scope._request.abort();

				scope.emit("timeout");
				scope.emit("error", Error("ETIMEDOUT"));
			}
		}, options.timeout || 1e4);
	}

	return true;
};

Request.prototype.setEncoding = function(encoding){
	//if we are connected, send the encoding to the response
	if(this._resp) this._resp.setEncoding(encoding);
	//else, safe it for later
	else this._options.encoding = encoding;
};
Request.prototype.abort = function(){
	this._request.abort();
};
Request.prototype.write = function(chunk){
	if(!this.writable) throw Error("Either request method doesn't support .write or request was sent!");
	return this._request.write(chunk);
};
Request.prototype.setHeader = function(name, value){
	if(arguments.length < 2) throw Error("wrong number of arguments");
	if(this._request){
		return this._request.setHeader(name, value);
	}
	if(typeof this._options.headers !== "object"){
		this._options.headers = {__proto__: null};
	}
	this._options.headers[name.toLowerCase()] = value;
};
Request.prototype.getHeader = function(name){
	if(arguments.length < 1) throw Error("wrong number of arguments");
	if(this._request){
		return this._request.getHeader(name);
	}
	return this._options.headers && this._options.headers[name.toLowerCase()];
};
Request.prototype.removeHeader = function(name){
	if(arguments.length < 1) throw Error("wrong number of arguments");
	if(this._request){
		return this._request.removeHeader(name);
	}
	return this._options.headers && delete this._options.headers[name.toLowerCase()];
};

module.exports.Request = Request;