dojo.provide("stream.StreamLayer");
dojo.require("esri.layers.FeatureLayer");

/**
  esri.layers.StreamLayer

  Constructor Params:
    url - URL string to a Streaming Feature Service in ArcGIS Server
    options - An object with custum settings for any public properties

*/
dojo.declare("stream.StreamLayer", esri.layers.FeatureLayer, {
    constructor: function(url, options) {
      this.options = options;

      // rules for removing data
      this.purgeOptions = new stream.PurgeOptions( this, options.purgeOptions || {} );
      this.socketUrl = this.options.socketUrl;
      // hash of temporal bins, makes for easy counting & tracking of data in time
      this.timeHash = {};
      this.id = 'streamingLayer';

    },

     /********************
     * Public Properties
     *
     * loadHistoric
     * socketUrl
     * purgeOptions
     *  - displayCount
     * socket
     * timeHash
     * timeExent
     ********************/

    /**********************
     * Internal Properties
     *
     * _connected
     *
     **********************/

    /**
     * Called after initial service request
     * FIXME always calls /query which fails when a feature service does not exist (streaming only, no saving)
     *  - Talked to praveen about creating a MODE called "Manual" that would never query for features unless told to
     */
    _initLayer: function(response, io){
      this.inherited( arguments );

      //if (response) {
        //this.socketUrl = this.options.socketUrl || undefined;//response.socketUrl || this.options.socketUrl || undefined;

        // connect if the layer has been added to the map already
        if (this._map && this.socketUrl && !this._connected){
          this.connect( this.socketUrl )
        }
      //}
    },


    _setMap: function(){
      // connect to the socket if the layer is already added to a map
      /*if (this.socketUrl && !this._connected){
        this.connect( this.socketUrl )
      }*/
      return this.inherited( arguments );
    },

    _unsetMap: function(map, container) {
      dojo.forEach(this._connects, dojo.disconnect, dojo);
      if (this.socket._connected) {
        this.disconnect();
      }
      this._map = null;
    },

     /**
     * Add graphic to map
     * resolve changes in time hash
     */
    add: function( graphic ) {
      /*var t = graphic.attributes[ this.timeInfo.startTimeField ];
      if (!this.timeHash[ t ]) {
        this.timeHash[ t ] = [ graphic.attributes[ this.objectIdField ] ];
      } else {
        this.timeHash[ t ].push( graphic.attributes[ this.objectIdField ] );
      }*/
        var t = graphic.attributes[ "created_at" ];
        if (!this.timeHash[ t ]) {
          this.timeHash[ t ] = [ graphic.attributes[ "id" ] ];
        } else {
          this.timeHash[ t ].push( graphic.attributes[ "id" ] );
        }

      this.inherited( arguments );
    },


    /**
     * Remove a graphic from map
     * resolves changes in time hash for removed graphic
     */
    remove: function( graphic ){

      if (this.options.visualization_mode != 'aggregate'){
        if ( this.timeHash[ graphic.attributes[ this.timeInfo.startTimeField ] ] ) {
          this.timeHash[ graphic.attributes[ this.timeInfo.startTimeField ] ]
            .splice( this.timeHash[ graphic.attributes[ this.timeInfo.startTimeField ] ].indexOf( graphic.attributes[ this.objectIdField ] ), 1 );
          if ( !this.timeHash[ graphic.attributes[ this.timeInfo.startTimeField ] ].length ) {
            delete this.timeHash[ graphic.attributes[ this.timeInfo.startTimeField ] ];
          }
        }
      }
      this.onRemove( { graphic: graphic });
      this.inherited( arguments );
    },

    // override
    refresh: function(){
      this._purge();
    },


    /**
     * Handled disconnecting to socket on layer destroy
     */
    destroy: function(){
      this.disconnect();
      this.inherited(arguments );
    },

    /*****************
     * Public Methods
     *****************/

    /**
     * connects to web socket
     *
     */
    connect: function( conn ){
      var self = this;
      if (!this._connected){
        console.log('CONNECTING', conn);
        this.socket = new WebSocket( conn );
        console.log('SOCKET', this.socket)
        this.socket.onopen = function () {
          console.log("Socket connected: ",new Date());
          //self.socket.emit('subscribe', self.layerId); // TODO change to use channel
          this._connected = true;
          self.onConnect();
          self._bind();
        };
        this.socket.onerror = function(e){
        	console.log('Socket error:',e);
        };
        this.socket.onclose = function(m){
          if (this._connected){
            console.log("Socket disconnected: ", m);
            this._connected = false;
            self.onDisconnect();
          }
        };
      }
    },


    /**
     * Stops listening for feature events over sockets
     *
     */
    disconnect: function(){
    	var self = this;
      this.socket.close();
      this._connected = false;
      this.onDisconnect();
    },


    /**
     * Events emitted
     */
    onMessage: function(){},
    onRemove: function(){},
    onConnect: function(){},
    onDisconnect: function(){},


    /**
     * Returns the visible time extent array (min/max)
     * builds it from the timeHash
     */
    getVisibleTimeExtent: function(){
      var keys = Object.keys(this.timeHash).sort();
      return [parseInt( keys[0] ), parseInt( keys[keys.length - 1 ] ) ];
    },

    /**
     * Gets a version of the local timeHash that injects missing times based on a given resolution in milliseconds 
     * 
     */
    getFullTimeHash: function( res ){
      var hash = {};
      var prev = null;
      for (var time in this.timeHash){
        var timeInt = parseInt(time);
        if ( res && prev && Math.abs(timeInt - prev) > res){
          var diff = Math.abs(timeInt - prev);
          for (var i = 0; i < diff / res; i++ ){
            hash[ prev + ( i * res )] = [];             
          }
        }
        hash[time] = this.timeHash[ time ];
        prev = timeInt;
      }
      return hash;
    },


    /*****************
     * Internal Methods
     *****************/

    /**
     * Removes excess points and updates the timeExtent
     *
     */
    _purge: function(){
      if (this.purgeOptions.displayCount && this.graphics.length > this.purgeOptions.displayCount ){
        for (var i = 0; i < (this.graphics.length - this.purgeOptions.displayCount); i++){
          this.remove( this.graphics[0] );
        }
      }
    },

    /**
     * sets up bindings to each socket event type
     * TODO support multiple types of events: create, delete, and update
     *
     */
    _bind: function(){
      var self = this;
      this.socket.onmessage = function(m) {
        // support CREATE, UPDATE, DELETE
        // m.type m = {type: 'Create', message: [ feature ]}
        // m.type m = {type: 'Update', message: [ feature ] }
        // m.type m = {type: 'Delete', message: [ id ]}
        //console.log("Message: ", m.data);
        self._onMessage(JSON.parse(m.data));
      };
    },


    /**
     * Handle message events
     * add to map and update timeextent
     */
    _onMessage: function( feature ){
      var self = this;
      if ( feature.shape ) {

        var graphic = new esri.Graphic(self._constructEsriFormat(feature));
        
        this.add( graphic );
        
        this.refresh();

        // update the timeHash
        this._updateTimeExtent( graphic );
        


        // emit the onMessage event with the graphic
        this.onMessage( { graphic: graphic } );
        
        if(app.Aggregator){
        	app.Aggregator.add(graphic);
        }
      }
    },
    
    /**
     * Construct Esri JSON format
     */
    _constructEsriFormat: function(data){
    	var self = this;
    	var esriFormat = {
    			geometry:{},
    			attributes:{},
    			spatialReference:{}
    	};
    	var attributes = {};
    	
    	if(data.shape){
    		for(var prop in data){
    			if(typeof(data[prop])!="function"){
    				if(prop=="shape"){
    					//shape field
    					esriFormat.geometry = data[prop];
    				}
    				else{
    					//attributes fields
    					attributes[prop] = data[prop];
    				}
    			}
    		}
    		esriFormat.attributes = attributes;
    	}
    	return esriFormat;
    },

    /**
     * Adjusts the max time extent for the layer based on new data
     *
     */
    _updateTimeExtent: function( graphic ){
      var time = graphic.attributes[ this.timeInfo.startTimeField ];
      var d = new Date( time );
      if ( !this.timeExtent ) {
        
        this.timeExtent = new esri.TimeExtent( d, d );
      } else if ( d > this.timeExtent.endTime.getTime()) {
        this.timeExtent.endTime = new Date( time );
      } else if ( d < this.timeExtent.startTime.getTime() ) {
        this.timeExtent.startTime = new Date( time );
      }
    },


    /**
     * Get more features from the server
     * TODO either remove this method and use query feature on the FeatureLayer
     *   - or keep it and overrider queryFeatures
     */
    /*requestFeatures: function(params) {
      var self = this;

      var timeExtent = new esri.TimeExtent(new Date(params.min), new Date(params.max));

      var i = 0,
        reqs = params.layers.length,
        cnt = 0,
        lyr = 0;

      while (i <= params.layers.length - 1) {

        var url = params.layers[i]._url.path;
        var queryTask = new esri.tasks.QueryTask(url);

        var query = new esri.tasks.Query();
        query.returnGeometry = true;
        query.outFields = ['*'];
        query.timeExtent = timeExtent;

        queryTask.execute( query, function( featureSet, layer ) {
          var features = featureSet.features;
          //console.log( 'features length', features.length );

          params.layers[lyr].clear();
          params.layers[lyr].timeHash = [];
          for(var i = 0, il = features.length; i<il; i++) {
            var point = new esri.geometry.Point( features[i].geometry.x, features[i].geometry.y, self._map.spatialReference);

            var graphic = new esri.Graphic( point );
            graphic.setAttributes( features[i].attributes );

            renderer = params.layers[lyr].renderer;
            params.layers[lyr].setRenderer( renderer );
            params.layers[lyr].add( graphic );
          }
          lyr++;
          if ( cnt === reqs ) self.emit( 'message' );

        });

        cnt++;
        i = i + 1

      }
    }*/

});


dojo.declare("stream.PurgeOptions", dojo.Stateful, {
  constructor: function( parent, options ) {
    this.parent = parent;
    for ( var p in options ){
      this[p] = options[p];
    }
  },

  _displayCountSetter: function( count ){
    this.displayCount = count;
    this.parent.refresh();
  }
});
