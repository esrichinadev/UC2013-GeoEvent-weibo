dojo.provide("processors.Anvil");
// dojo.require("esri.processors");

/**
  esri.processors.Anvil

  params:
    url - URL string to a Streaming Feature Service in ArcGIS Server
    options - An object with custum settings for any public properties
      proxyUrl - (e.g. "http://river.local/Projects/esri/ags-streaming/public/proxy.php?url=")
  public properties (configurable by the user via options):
    processorUrl <String> - base url path to the Geoevent server

  private properties (supplied by the streaming service):
    sourceType - Type of feature coming in. For instance Twitter or Instagram. This is read-only to user.
    objectIdField - Override of FeatureLayer property. Field name that is unique identifier for features. For example id_str for Tweets
    entityIdField  - Name of field that sorts data into logical groups. For example user_id_str for Tweets. This will get mapped to the timeInfo. trackIdField property of the FeatureLayer.
    timeStampField - Field name containing time stamp. This will get mapped to the timeInfo.startTimeField or endTimeField of the FeatureLayer.
    updateMethod - Method socket.io was able to establish for retrieving new features. Either stream or poll.
    isQueryable - Flag for if features are backed by persistent data store that enables querying for historical data. This is read from the ArcGIS Server Stream Service.
    socketConnection - Connection information for socket. Read-only.

  Events:


*/
dojo.declare("processors.Anvil", null, {
    constructor: function(url, options) {
      console.log("ANVIL CONSTRUCTOR");
      this.options = options || {};
      this.keywords = [];
      this.baseUrl = url;
      this.proxyUrl = this.options.proxyUrl || "";
      console.log("PROXYURL: ", this.proxyUrl);
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
    Create a new twitter stream.
    params:
      options - object with properties to configure anvil request
        socketUrl - url of websocket to broadcast messages to (required)
        keywords: array of keyword strings (optional)
        geometry - ESRI Json polygon object in 4326 spatial reference (optional)
        limit - maximum number of messages to broadcast (optional)
     */
    streamTwitter: function(options, cbLoad, cbError) {
      if (! options || ! options.socketUrl){
        cbError && cbError({error: "Invalid options object. Cannot be null and socketUrl property is required"});
        return;
      }
      var self = this;
      self.socketUrl = options.socketUrl;
      var uuid = Math.round(new Date().getTime() / 1000);
      var name = uuid + "-twitter",
          data = {   "name": name
                   , "id": name
                   , "socket_url": self.socketUrl
                   , "keywords": options.keywords
                   , "geometry": options.geometry
                   //, "geometry": {"rings": [[[-180.0, -85.0], [-180.0, 85.0], [180.0, 85.0], [180.0, -85.0], [-180.0, -85.0]]]}
                   , "limit":  options.limit || 1000
                   , "source": "twitter"};

      console.log("Post to Anvil: ", JSON.stringify(data));

      // Create the service
      var xhrArgs = {
        url: this.baseUrl + "/streams/socialdev",
        postData: dojo.toJson(data),
        handleAs: "json",
        headers: { "Content-Type": "application/json"},
        load: function(data){
          console.log("Success: ", data);
          data = self._deproxy(data);
          cbLoad(data);
        },
        error: function(error){
          console.log("Error: ", error);
          if(cbError) cbError(error);
        }
      };

      if (this.proxyUrl){
        xhrArgs.url = this.proxyUrl + "?" + xhrArgs.url;
        console.log("URL: ", xhrArgs.url);
      }
      var deferred = dojo.xhrPost(xhrArgs);

      return name;
    }
});