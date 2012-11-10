#minreq
A minimalistic request library for node.

##How?
    npm install minreq

##Why?

The most common library used to perform http(s)-requests in node is [request](https://github.com/mikeal/request). While it works, it has a lot of features that aren't needed in most cases (eg. cookies, oauth). Besides, the code isn't as fast as it can be. This project is intended to replace `request` in cases where it's simply too heavy.

##What?
###Features
* `request` like api
* lightweight (compared to this lib, `request` is a giant)
* provides a callback that's called when a response was received (like request)
* works as a stream (`Stream#pipe` is supported)
* forwards events
* follows redirects
* you may add your own protocols!

###Options
* `uri`: Object that's passed to http(s).request ([as described here](http://nodejs.org/docs/latest/api/all.html#http.request))
* `followRedirect`: Boolean that indicates whether redirects should be followed
* `maxRedirects`: int with the maximum number of redirects (defaults to 10)
* `body`: that data that should be passed to the request
* `encoding`: the encoding that all data should use (the body will always be a string)
* `timeout`: a request times out if it passes this limit. Defaults to 10000 (read: 10 seconds)
* `only2xx`: only permit status codes >= 200 and < 300 (otherwise, throw an error)

###TODO
* add documentation
* ease adding other protocols