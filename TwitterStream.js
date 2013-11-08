dojo.provide("stream.TwitterStream");

/**
  Creates a new TwitterStream that creates a StreamService, starts a twitter collection and adds a StreamLayer to the map
**/
dojo.declare("stream.TwitterStream", null, {
    constructor: function( map, options ) {
      this.map = map;
      this.options = options;
      this.app = this.options.app || {};
      //console.log("OPTIONS: ", this.options);

      this.tweet_track = {
        tweets: [
          {user:'Tony Mayes', text:'#WILD pic of downtown #NYC with no power #SANDY <a href="http://t.co/ZkFyOpzF" target="_blank">http://t.co/ZkFyOpzF</a>'},
          {user:'Emily Wood', text:'OH: "theres life above 28th street." coffee and power outlet bound...! #nycblackout #Sandy'},
          {user:'adrianf', text:'The great exodus: we walked 41 blocks with the dog &amp; the contents of our fridge to Juliennes (and power)'},
          {user:'Derrick Chen', text:'Everyone I know who lives in downtown Manhattan has left to go to powered parts of the city. Pretty crazy'},
          {user:'Richard Ashley', text:'Wandering through aisles of stores barely open, entire families huddle around electric outlets for what little power they can get. #Sandy'}
        ],
        max: 5
      }

      this.Aggregator = (this.options.Aggregator) ? this.options.Aggregator : null;
      // Create a new service
      this.createService(options.service.url, options.service.params );
    },

    // creates a new StreamService in AGS
    createService: function( url, options ){

      var self = this;
      this.db = options.db;
      this.svc_name = ( options.service_name )
          ? options.service_name
          : 'tweets_' + ( Math.round( Math.random() * 100000).toString(16)) + (new Date()).getTime().toString(16)

      var service_params = {
        serviceName: this.svc_name,
        type: 'StreamServer',
        description: 'Tweets that mention ... beep boop',
        extent: { rings: [ [ ] ], spatialReference: { wkid: 4326 } },
        spatialReference: { wkid: 4326 },
        datastore: this.db,
        fields: this._fields,
        uniqueIdField: 'id',
        entityIdField: null,
        timestampField: 'posted_time',
      };

      var keywords = this.options.service.params.keywords;

      // check for an existing service via the alto keyword
      if ( keywords.indexOf('alto') > -1 ) {
        keywords.splice( keywords.indexOf('alto'), 1 );
        this.svc_name = keywords[0];
        this.addStreamLayer()
      } else {
        new stream.StreamService( url, service_params,
          function(data){
          self.createLayer( function(){
            self.createStream( data.service, function(){ });
          });
        });
      }

    },

    _fields: [
      { name: 'fid', type: 'esriFieldTypeOID', alias: 'fid' },
      { name: 'id', type: 'esriFieldTypeInteger', alias: 'id' },
      { name: 'id_str', type: 'esriFieldTypeString', alias: 'id_str' },
      { name: 'user_id_str', type: 'esriFieldTypeString', alias: 'userid' },
      { name: 'user_name', type: 'esriFieldTypeString', alias: 'user_name'},
      { name: 'text', type: 'esriFieldTypeString', alias: 'text' },
      { name: 'posted_time', type: 'esriFieldTypeDate', alias: 'posted_time' },
      { name: 'created_at', type: 'esriFieldTypeString', alias: 'created_at' },
      { name: 'user_friends', type: 'esriFieldTypeSmallInteger', alias: 'friends' },
      { name: 'user_followers', type: 'esriFieldTypeSmallInteger', alias: 'followers' },
      { name: 'retweeted', type: 'esriFieldTypeSmallInteger', alias: 'retweeted' },
      { name: 'retweet_count', type: 'esriFieldTypeSmallInteger', alias: 'retweet_count' },
      { name: 'stream_id', type: 'esriFieldTypeString', alias: 'stream_id' },
      { name: 'place_id', type: 'esriFieldTypeString', alias: 'place_id' },
      { name: 'place_fullname', type: 'esriFieldTypeString', alias: 'place_fullname' }
    ],


    // create a new StreamService in AGS
    createLayer: function( callback ){
      var self = this;

      // check if the analysis will be an aggregation
      if ( self.options.service.params.aggregate && !this.app.Aggregator){

        this.app.boundary = this.app.boundaries[ self.options.service.params.aggregate.boundary ];

        // Init aggregator
        var options = {
            layer: {
              url: this.app.boundary.url,
              params : {
                boundary: self.options.service.params.aggregate.boundary,
                type: self.options.service.params.aggregate.type,
                attributes: self.options.service.params.aggregate.attributes,
                zoomToExtent: this.app.boundary.zoomToExtent,
                geojson: this.app.boundary.geojson,
                attrs: [
                  { key: 'id', value: function( d ){ return ( d[self.app.boundary.key] ) ? d[self.app.boundary.key] : d.properties[self.app.boundary.key].replace(/\./g, ''); }},
                  { key: 'class', value: 'agg' }
                ]
              }
            }
        }
        // The Aggregator handles our polygon layer aggregation and rendering
        this.Aggregator = new modules.AggregationLayer( options.layer.url, options.layer.params );

        // create a style element with css classes
        this.Aggregator.breaks = this.options.service.params.style.breaks;
        this.Aggregator.class_type = this.options.service.params.style.classificationType;
        this.Aggregator.buildStyle( this.options.service.params.style, this.options.service.params.aggregate.empty_boundaries );

        dojo.connect(this.Aggregator, "onLoad", function(lyr) {
          self.addStreamLayer( callback );
        });
        this.map.addLayer( this.Aggregator );
      } else if ( this.app.Aggregator ){
        this.Aggregator = this.app.Aggregator;
        this.addStreamLayer( callback );
      } else {
        this.addStreamLayer( callback );
      }

    },


    addStreamLayer: function( callback ){
      //console.log('add stream layer', this.options.layer.url + '/' + this.svc_name);
      var self = this;

      this.layer = new stream.StreamLayer( this.options.layer.url + '/' + this.svc_name + '/FeatureServer/0', {
        id: 'streamingLayer',
        purgeOptions: { displayCount: this.options.service.displayCount},
        outFields: [ "*" ],
        visible: true, //(this.options.service.params.aggregate) ? false : true,
        visualization_mode: (this.options.service.params.aggregate) ? 'aggregate' : null
      });

      var renderer = new esri.renderer.SimpleRenderer(
        new esri.symbol.SimpleMarkerSymbol(esri.symbol.SimpleMarkerSymbol[ this.options.service.params.style.shape || "STYLE_CIRCLE"], 4, //this.options.service.params.style.size,
        new esri.symbol.SimpleLineSymbol(esri.symbol.SimpleLineSymbol.STYLE_SOLID,
        new dojo.Color( this.options.service.params.style.stroke.color || "rgb(255, 255, 255)" ), this.options.service.params.style.stroke.width),
        new dojo.Color( this.options.service.params.style.fill || "rgb(5, 112, 176)" )
      ));

      this.layer.setRenderer( renderer );
      this.map.addLayer( this.layer );

      dojo.connect( this.layer, "onMouseOver", function( e ) {
        var a = e.graphic.attributes;
        // make keywords bold
        self.options.service.params.keywords.forEach(function(k){
          a.text = a.text.replace(k, '<b>' + k + '</b>');
        });
        var tmpl = '<div>\
          <span id="username">'+a.user_name+': </span>\
          <span class="single-tweet-text">'+a.text+'</span>\
          <span class="single-tweet-time">'+new Date(a.created_at).toLocaleString()+'</span>\
        </div>'
        app.openDialog( e, tmpl );
      });
      dojo.connect( this.layer, 'onLoad', function( lyr ) {
        self.layer.setRenderer( renderer );
        self.onLoad( { layer: lyr } );
        callback && callback();
      });

      dojo.connect( this.layer, 'onMessage', function( message ){
        if ( !self.layer.stats ) self.layer.stats = { geolocated: 0 }
        if ( message.graphic.geometry ) self.layer.stats.geolocated++;
        if ( self.Aggregator ) self.Aggregator.add( message.graphic );

        // LEAVE in for now, builds a simple/dump copy of recent tweets
        /*self.tweet_track.tweets.push( message );
        if (self.tweet_track.tweets.length >= self.tweet_track.max){
          self.tweet_track.tweets.shift();
        }*/
      });

    },

    // creates a new steam in Anvil or GES
    createStream: function( service, callback, errorCallback ){

      // do some logic for keyword whitelist for GES
      var keywords = this.options.service.params.keywords,
      processor;
      if ( keywords.indexOf('ges') > -1 ) {
        console.log("GES stream needed");
        keywords.splice( keywords.indexOf('ges'), 1 );
        processor = new processors.Geoevent( this.options.stream.ges, {user: "arcgis", password: "manager", proxyUrl: "", twitterCreds:this.options.stream.twittercreds});
        processor.streamTwitter({ socketUrl: service.webSocketUrl, keywords: keywords });

      } else if ( keywords.indexOf('anvil') > -1 ){
        keywords.splice( keywords.indexOf('anvil'), 1 );
        console.log("ANVIL stream needed: ", this.options.stream.anvil);
        processor = new processors.Anvil( this.options.stream.anvil, this.options );
        console.log("ANVIL stream needed: ", processor);
        processor.streamTwitter( { socketUrl: service.webSocketUrl, keywords: keywords, proxyUrl: this.options.proxyUrl }, callback, errorCallback);
      } else {
        // FAKESPONGE
        console.log('SERVICE DATA', this.options)
        var postOpts = {
          id: service.serviceName,
          keywords: this.options.service.params.keywords,
          limit: this.options.service.limit,
          offline: this.options.service.offline,
          socket_url: service.webSocketUrl,
          source: 'tweetsponge'
        }

        dojo.xhrPost({
          url: this.options.stream.url,
          postData: dojo.toJson( postOpts ),
          handleAs: 'json',
          headers: { "Content-Type": "application/json"},
          load: function(data){
            callback && callback(data);
          },
          error: function(error){
            errorCallback && errorCallback( error );
          }
        });
      }
    },

    // EVENTS
    onLoad: function(){}
});
