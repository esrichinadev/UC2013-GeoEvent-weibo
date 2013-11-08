dojo.provide("processors.Geoevent");

/**
  esri.processors.Geoevent

  params:
    url - URL string to a Streaming Feature Service in ArcGIS Server
    options - An object with custum settings for any public properties
      proxyUrl - (e.g. "http://river.local/Projects/esri/ags-streaming/public/proxy.php?url=")\
      user
      password
      twitterCreds - consumer and access tokens for accessing twiiter application
  public properties (configurable by the user via options):
    processorUrl <String> - base url path to the Geoevent server

  private properties (supplied by the streaming service):

  Events:


*/
dojo.declare("processors.Geoevent", null, {
    constructor: function(url, options) {
      //console.log("Constructor for Geoevent: ", options);
      this.options = options || {};
      this.baseUrl = url + "geoevent/admin/";
      this.user = this.options.user;
      this.password = this.options.password;
      this.proxyUrl = this.options.proxyUrl || "";
      this.twitterCreds = options.twitterCreds;
    },

    /**
    * Internal: unwraps the proxy response if used
    */
    _deproxy: function(data) {
      if(this.proxyUrl == "")
        return data;
      else
        return data.contents;
    },

    /**
     * Returns an array of all registered inputs.
     *
     * @param {Function} cbError Callback function if the delete request fails. function(error) { console.log(error); }
     * @returns none
     */
    inputs: function(cbLoad,cbError) {
      var self = this;
      // http://192.168.199.136:8182/ges/admin/
      var xhrArgs = {
        url: this.proxyUrl + this.baseUrl + "inputs.json",
        handleAs: "json",
        headers: {
            "Authorization": "Basic " + Base64.encode(this.user + ":" + this.password)
        },
        load: function(data){
          data = self._deproxy(data);
          if(cbLoad) cbLoad(data);
        },
        error: function(error){
          if(cbError) cbError(error);
        }
      }
      // Call the asynchronous xhrGet
      var deferred = dojo.xhrGet(xhrArgs);
    },

    /**
     * Returns an array of all registered outputs.
     *
     * @param {Function} cbLoad Callback function when the delete is completed. function(data) { console.log(data); }
     * @param {Function} cbError Callback function if the delete request fails. function(error) { console.log(error); }
     * @returns none
     */
    outputs: function(cbLoad,cbError) {
      var self = this;
      // http://192.168.199.136:8182/ges/admin/
      // The parameters to pass to xhrGet, the url, how to handle it, and the callbacks.
      var xhrArgs = {
        url: this.proxyUrl + this.baseUrl + "outputs.json",
        handleAs: "json",
        headers: {
            "Authorization": "Basic " + Base64.encode(this.user + ":" + this.password)
        },
        load: function(data){
          data = self._deproxy(data);
          if(cbLoad) cbLoad(data);
        },
        error: function(error){
          if(cbError) cbError(error);
        }
      }
      // Call the asynchronous xhrGet
      var deferred = dojo.xhrGet(xhrArgs);
    },

    /**
     * Returns an array of all registered services.
     *
     * @param {Function} cbLoad Callback function when the delete is completed. function(data) { console.log(data); }
     * @param {Function} cbError Callback function if the delete request fails. function(error) { console.log(error); }
     * @returns none
     */
    services: function(cbLoad,cbError) {
      var self = this;
      var xhrArgs = {
        url: this.proxyUrl + this.baseUrl + "geoeventservices.json",
        handleAs: "json",
        headers: {
            "Authorization": "Basic " + Base64.encode(this.user + ":" + this.password)
        },
        load: function(data){
          data = self._deproxy(data);
          if(cbLoad) cbLoad(data);
        },
        error: function(error){
          if(cbError) cbError(error);
        }
      }
      var deferred = dojo.xhrGet(xhrArgs);
    },

    /**
     * Stops a twitter collection by deleting all of the relevant service components.
     *
     * @param {String} prefix Unique identifier prefix for the geoeventservice definitions to be deleted.
     * @param {Function} cbLoad Callback function when the delete is completed. function(data) { console.log(data); }
     * @param {Function} cbError Callback function if the delete request fails. function(error) { console.log(error); }
     * @returns
     */
    stopTwitter: function(prefix, cbLoad, cbError) {
      var self = this,
       nodes = [],
       i;

      self.inputs(function(inputs) {
        for(i=inputs.length-1; i >= 0; i--) {
          if(inputs[i].name.match(prefix)) {
            nodes.push(inputs[i].name);
            self.deleteService('input',inputs[i].name);
          }

          self.outputs(function(outputs) {
            for(i=outputs.length-1; i >= 0; i--) {
              if(outputs[i].name.match(prefix)) {
                nodes.push(outputs[i].name);
                self.deleteService('output',outputs[i].name);
              }}
              self.services(function(services) {
                for(i=services.length-1; i >= 0; i--) {
                  if(services[i].name.match(prefix)) {
                    nodes.push(services[i].name);
                    self.deleteService('geoeventservice',services[i].name);
                  }}
                if(cbLoad) cbLoad(nodes);
              }, function(error) {if(cbError) cbError(error);})
          }, function(error) {if(cbError) cbError(error);})
        }
      }, function(error) {if(cbError) cbError(error);})
    },

    /**
     * Starts a new Geoevent Service for Twitter with an file and websocket output.
     *
     * @param {Object} object of options: {socketUrl <String>, keywords <Array>}
     * @param {Function} cbLoad Callback function when the delete is completed. function(data) { console.log(data); }
     * @param {Function} cbError Callback function if the delete request fails. function(error) { console.log(error); }
     * @returns Unique identifier prefix for the geoeventservice definitions.
     * @type String
     */
    streamTwitter: function(options, cbLoad, cbError) {
      var self = this;
      self.socketUrl = options.socketUrl || "10.112.24.138:5001";
      var uuid = Math.round(new Date().getTime() / 1000);
      var name = uuid + "-stream";
      self.keywords = options.keywords || [];
      if(typeof self.keywords === 'string') {
        self.keywords = [self.keywords]
      }
      var serviceOld = {name: name,
        runningState: "STARTED",
        flow: [{ ref: "twitter-in",
           to: [{ref: uuid + "-websocket"}
               ,{ref: uuid + "-file-out"}]} ],
        inputs: [{ref: "twitter-in", "left": "10", "top": "10", "width": "60", "height": "60"}],
        outputs: [{ref: uuid + "-websocket", "left": "1000", "top": "10", "width": "60", "height": "60"},{ref: uuid + "-file-out", "left": "1000", "top": "100", "width": "60", "height": "60"}]
      };

      var service = {
        "name": name,
        "runningState": "STARTED",
        "inputs": [{
          "ref": "twitter-in",
          "left": 80,
          "top": 60,
          "width": 80,
          "height": 70
        }],
        "outputs":[{
          "ref": uuid + "-websocket",
          "left": 280,
          "top": 60,
          "width": 80,
          "height": 70
        }],
        "nodes":[{
          "name": "Filter",
          "left": 180,
          "top": 63,
          "width": 80,
          "height": 70,
          "filter":{
            "conditions": [{
              "attributeCondition": {
                "operand": "text",
                "operator": "MATCHES",
                "value": ".*" + self.keywords.join("|") + ".*"
              }
            }]
          }
        }],
        "flow": [{
          "ref": "twitter-in",
          "choice": [],
          "to": [{
            "ref": "Filter",
            "path": "120,95 140,95",
            "custom": "false"
          }]
        },
        {
          "ref": "Filter",
          "choice": [],
          "to":[{
            "ref": uuid + "-websocket",
            "path": "220,95 240,95",
            "custom": "false"
          }]
        }]
      };

      var outputs = [{
        "name": uuid + "-websocket",
        "connector": "websocket",
        "adapter": {
          "properties": [
            {"name": "charSet", "value": "UTF-8"},
            {"name": "flattenEvents", "value": "true"},
            {"name": "updateInterval", "value": "1000"},
            {"name": "prettyJson", "value": "false"},
            {"name": "mimeType", "value": "application/json"}
          ],
          "uri": "com.esri.ges.adapter.outbound/JSON/0.8.5"
        },
        "transport":{
          "properties": [
            {"name": "PATH", "value": "/ws"},
            {"name": "MODE", "value": "CLIENT"},
            {"name": "PROTOCOL", "value": ""},
            {"name": "URI", "value":self.socketUrl}
          ],
          "uri": "com.esri.ges.transport.outbound/WebSocket/0.8.5"
        },
        "runningState": "STARTED",
        "supportsAllGeoEventDefinitions": true,
        "supportedGeoEventDefinitions": []
      }];

      // Create the service
      var all_keywords = [],
      i,
      p;
      self.inputs(function(inputs) {
        for(i=0; i<inputs.length; i++) {
          if(inputs[i].name.match('twitter-in')) {
            for(p=0; p < inputs[i].transport.properties.length; p++){
              if(inputs[i].transport.properties[p].name.match(/track/)) {
                all_keywords = inputs[i].transport.properties[p].value;
              }}}}
        all_keywords += ", " + self.keywords.join(",");
        //console.log("TweetCreds: ", self.twitterCreds);
        var inputs = [{
          "name": "twitter-in",
          "connector": "esri-in-twitter-tweet-receive",
          "adapter": {
            "uri": "com.esri.ges.adapter.inbound/TweetStatusAdapter/0.8.5"
          },
          "transport": {
            "properties":[
              {"name": "consumerKey",
                "value": self.twitterCreds.consumer_key},
              {"name": "consumerSecret",
                "value": self.twitterCreds.consumer_secret},
              {"name": "accessToken",
                "value": self.twitterCreds.access_token},
              {"name": "accessTokenSecret",
                "value": self.twitterCreds.access_secret},
              {"name": "count", "value": "0"},
              {"name": "locations", "value": ""},
              {"name": "track", "value": all_keywords},
              {"name": "follow", "value": ""}
            ],
            "uri": "com.esri.ges.transport.inbound/Twitter/0.8.5"
          },
          "runningState": "STARTED",
          "supportsAllGeoEventDefinitions": true,
          "supportedGeoEventDefinitions": []
        }];

         self.createService(name, [service], inputs, outputs,
            function (data) { // cbLoad
              if(cbLoad) cbLoad(data);
            }, function (error){ // cbError;
              if(cbError) cbError(error);
            });

      }, function(error) { if(cbError) cbError(error);} );

      return uuid;
    },

    /**
     * Removes a service from the Geoevent Processor
     *
     * @param {String} type Geoevent service type: input,output,geoeventservice
     * @param {String} name Unique defined name of the service.
     * @param {Function} cbLoad Callback function when the delete is completed. function(data) { console.log(data); }
     * @param {Function} cbError Callback function if the delete request fails. function(error) { console.log(error); }
     * @returns none
     */

    deleteService: function(type, name, cbLoad, cbError) {
      var self = this;
      var xhrArgs = {
        url: this.proxyUrl + this.baseUrl + type + "/" + name + ".json",
        handleAs: "json",
        headers: { "Content-Type": "application/json"
                    ,"Authorization": "Basic " + Base64.encode(this.user + ":" + this.password)
                  },
        load: function(data){
          data = self._deproxy(data);
          if(cbLoad) cbLoad(data);
        },
        error: function(error){
          if(cbError) cbError(error);
        }
      };
      var deferred = dojo.xhrDelete(xhrArgs);

    },

    /**
     * Removes a service from the Geoevent Processor
     * NOTE: actually calls the /configuration.json endpoint to do a batch modification.
     *
     * @param {String} name Unique defined name of the service.
     * @param {Array} services Array of geoeventservice definitions.
     * @param {Array} inputs Array of input definitions.
     * @param {Array} outputs Array of output definitions.
     * @param {Function} cbLoad Callback function when the delete is completed. function(data) { console.log(data); }
     * @param {Function} cbError Callback function if the delete request fails. function(error) { console.log(error); }
     * @returns none
     */
    createService: function(name, services, inputs, outputs, cbLoad, cbError) {
      var self = this;
      var data = {geoEventServices: services,
                  inputs: inputs,
                  outputs: outputs};

      var xhrArgs = {
        url: this.proxyUrl + this.baseUrl + "configuration.json",
        postData: dojo.toJson(data),
        handleAs: "json",
        headers: { "Content-Type": "application/json"
                    ,"Authorization": "Basic " + Base64.encode(this.user + ":" + this.password)
                  },
        load: function(data){
          data = self._deproxy(data);
          if(cbLoad) cbLoad(data);
        },
        error: function(error){
          if(cbError) cbError(error);
        }
      };
      var deferred = dojo.xhrPost(xhrArgs);
    }
});


/**
  Base64 provides simple encoding for Basic Authentication.
*/
var Base64 = {
// private property
_keyStr : "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",

// public method for encoding
encode : function (input) {
    var output = "";
    var chr1, chr2, chr3, enc1, enc2, enc3, enc4;
    var i = 0;

    input = Base64._utf8_encode(input);

    while (i < input.length) {

        chr1 = input.charCodeAt(i++);
        chr2 = input.charCodeAt(i++);
        chr3 = input.charCodeAt(i++);

        enc1 = chr1 >> 2;
        enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
        enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
        enc4 = chr3 & 63;

        if (isNaN(chr2)) {
            enc3 = enc4 = 64;
        } else if (isNaN(chr3)) {
            enc4 = 64;
        }

        output = output +
        Base64._keyStr.charAt(enc1) + Base64._keyStr.charAt(enc2) +
        Base64._keyStr.charAt(enc3) + Base64._keyStr.charAt(enc4);

    }

    return output;
},

// public method for decoding
decode : function (input) {
    var output = "";
    var chr1, chr2, chr3;
    var enc1, enc2, enc3, enc4;
    var i = 0;

    input = input.replace(/[^A-Za-z0-9\+\/\=]/g, "");

    while (i < input.length) {

        enc1 = Base64._keyStr.indexOf(input.charAt(i++));
        enc2 = Base64._keyStr.indexOf(input.charAt(i++));
        enc3 = Base64._keyStr.indexOf(input.charAt(i++));
        enc4 = Base64._keyStr.indexOf(input.charAt(i++));

        chr1 = (enc1 << 2) | (enc2 >> 4);
        chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
        chr3 = ((enc3 & 3) << 6) | enc4;

        output = output + String.fromCharCode(chr1);

        if (enc3 != 64) {
            output = output + String.fromCharCode(chr2);
        }
        if (enc4 != 64) {
            output = output + String.fromCharCode(chr3);
        }

    }

    output = Base64._utf8_decode(output);

    return output;

},

// private method for UTF-8 encoding
_utf8_encode : function (string) {
    string = string.replace(/\r\n/g,"\n");
    var utftext = "",
    n;

    for (n = 0; n < string.length; n++) {

        var c = string.charCodeAt(n);

        if (c < 128) {
            utftext += String.fromCharCode(c);
        }
        else if((c > 127) && (c < 2048)) {
            utftext += String.fromCharCode((c >> 6) | 192);
            utftext += String.fromCharCode((c & 63) | 128);
        }
        else {
            utftext += String.fromCharCode((c >> 12) | 224);
            utftext += String.fromCharCode(((c >> 6) & 63) | 128);
            utftext += String.fromCharCode((c & 63) | 128);
        }

    }

    return utftext;
},

// private method for UTF-8 decoding
_utf8_decode : function (utftext) {
    var string = "",
    i = 0,
    c = 0,
    c1 = 0,
    c2 = 0;

    while ( i < utftext.length ) {

        c = utftext.charCodeAt(i);

        if (c < 128) {
            string += String.fromCharCode(c);
            i++;
        }
        else if((c > 191) && (c < 224)) {
            c2 = utftext.charCodeAt(i+1);
            string += String.fromCharCode(((c & 31) << 6) | (c2 & 63));
            i += 2;
        }
        else {
            c2 = utftext.charCodeAt(i+1);
            c3 = utftext.charCodeAt(i+2);
            string += String.fromCharCode(((c & 15) << 12) | ((c2 & 63) << 6) | (c3 & 63));
            i += 3;
        }

    }
    return string;
}
}