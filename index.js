var Parser = require("htmlparser2").Parser,
    ElementType = require("htmlparser2").ElementType,
    Cornet = require("cornet"),
    DomUtils = require("domutils"),
    fs = require("fs"),
    minreq = require("minreq"),
    url = require("url");

function Inline(url, options, cb){
	if(typeof options === "function"){
		cb = options;
		options = {};
	} else if(!options){
		options = {};
	}
	this.url = url;
	this.cb = cb;
	this.options = options;
	this._cache = {};
	this._pending = 1;

	var handler = new Cornet(options);
	this.handler = handler;
	this.parser = new Parser(handler, options);

	var that = this;

	if(!("images" in options) || options.images){
		//inline images
		handler.select("img[src]:not([src^='data:'])", function(elem){
			that.getDataURI(elem.attribs.src, function(err, uri){
				if(err) return; //do nothing
				elem.attribs.src = uri;
			});
		});
	}

	if(!("scripts" in options) || options.scripts){
		//inline scripts
		handler.select("script[src]:not([src*='google-analytics.com'])", function(elem){
			that.load(elem.attribs.src, function(err, resp, body){
				if(err) return; //do nothing
				if(resp && resp.headers["content-type"] === "text/html"){
					return; //also ignore it
				}

				elem.children = [{
					type: ElementType.Text,
					data: body.toString("utf-8").replace(/<\/script>/gi, "<\\/script>")
				}];
				delete elem.attribs.src; //remove the attribute
				that.minifyScript(elem);
			});
		});

		//minify scripts
		handler.select("script:not([src])", function(elem){
			that.minifyScript(elem);
		});
	}

	if(!("stylesheets" in options) || options.stylesheets){
		//inline stylesheets
		handler.select("link[rel=stylesheet][href]", function(elem){
			that.load(elem.attribs.href, function(err, resp, body){
				if(err) return; //do nothing
				var idx = elem.parent.children.lastIndexOf(elem);
				//replace the element
				elem.parent.children.splice(idx, 1, {
					type: ElementType.Style,
					children: [{
						type: ElementType.Text,
						data: body.toString("utf-8")
					}]
				});
				that.processStyleElement(elem.parent.children[idx]);
			});
		});
		//inline url() and @import
		handler.select("style", function(elem){
			that.processStyleElement(elem);
		});
	}

	this.dom = null;
	handler.on("dom", function(dom){
		that.dom = dom;
		if(!--that._pending){
			that.done();
		}
	});
}

require("util").inherits(Inline, require("events").EventEmitter);

Inline.prototype.load = function(path, cb){
	var that = this;
	path = url.resolve(this.url, path);

	if(path in this._cache && this._cache[path] !== null){
		cb.apply(null, this._cache[path]);
		return;
	}

	this.on("l " + path, cb);

	if(path in this._cache) return;

	this._cache[path] = null;
	this._pending++;

	if(!/^https?:\/\//.test(path)){
		fs.readFile(path, function(err, data){
			that.emit("l " + path, err, null, data);
		});
	} else {
		minreq({ uri: path, only2xx: true }, function(err, resp, data){
			that.emit("l " + path, err, resp, data);
		});
	}

	this.on("l " + path, function(err, resp, data){
		if(--that._pending === 0){
			that.done();
		} else {
			that._cache[path] = [err, resp, data]; //cache it
		}
	});
};

Inline.prototype.write = function(c){
	this.parser.write(c);
};

Inline.prototype.end = function(c){
	this.parser.end(c);
};

Inline.prototype.writable = true;

Inline.prototype.done = function(){
	if(this.dom){
		this.cb(null, this.dom.map(DomUtils.getOuterHTML).join(""));
	}
};

Inline.prototype.processStyleElement = function(elem){
	// TODO
};

Inline.prototype.minifyScript = function(elem){
	// TODO
};

Inline.prototype.getDataURI = function(path, cb){
	this.load(path, function(err, res, body){
		if(err) cb(err);
		else if(!res || !("content-type" in res.headers)){
			cb(Error("no content-type was specified"));
		} else {
			cb(null, "data:" + res.headers["content-type"] + ";base64," + body.toString("base64"));
		}
	});
};

module.exports = Inline;