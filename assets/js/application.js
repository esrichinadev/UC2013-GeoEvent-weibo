//Main Application JS
require([
  "stream/StreamCreation",
  "modules/AddData",
  "stream/TimeSlider",
  "assets/js/config.js",
  "esri/map",
  "esri/arcgis/utils",
  "esri/toolbars/draw",
  "dijit/dijit",
  "stream/StreamService",
  "stream/StreamLayer",
  "stream/TwitterStream",
  "stream/SocialAPI",
  "modules/d3Layer",
  "modules/AggregationLayer",
  "modules/LayersPalette",
  "modules/Stats",
  "modules/About",
  "dojo/domReady!"
], function (CreationUI, AddDataUI, TimeSlider, config) {
  var Application = function(){

    this.init = function(){
      var self = this;

      this.layers = [];
      this.extentChaged = false;

      this.boundaries = config.boundaries;
      this.socialAPI = new stream.SocialAPI( config.social_stream );

      // store the config props in options for use throughout the app
      this.options = config;
      if ( location.hash.toLowerCase() == '#newyork'){
        var extent = new esri.geometry.Extent({"xmin":-8301530.085544113,"ymin":4930026.489066122,"xmax":-8118386.965772761,"ymax":5009520.998482736,"spatialReference":{"wkid": 102100}});
      } else {
        var extent = esri.geometry.geographicToWebMercator( new esri.geometry.Extent({"xmin":116.07,"ymin":39.79,"xmax":116.7,"ymax":40.04,"spatialReference":{"wkid":4326}}) );
      }

      var hash = this.parseHash();

      if ( hash.webmap ) {
        esri.arcgis.utils.createMap(hash.webmap, "map").then(function(response) {
          self.map = response.map;
          dojo.connect(dijit.byId("map"), "resize", self.map, self.map.resize);

          if ( hash.stream ){
            dojo.byId('creator').style.display = "none";
            self.initLayer( hash.stream );
          }

        });
      } else{
        this.map = new esri.Map("map",{
          extent: extent
        });

        var basemap = new esri.layers.ArcGISTiledMapServiceLayer("http://www.arcgisonline.cn/ArcGIS/rest/services/ChinaOnlineStreetGray/MapServer");
        this.map.addLayer(basemap);
        this.fullExtent = extent;
        dojo.connect(this.map, "onLoad", function(map) {
          dojo.connect(dijit.byId("map"), "resize", map, map.resize);
        });
        dojo.connect(this.map, "onKeyDown", function(e){
        	if(e.keyCode===16){
                if (self.Aggregator) {
                    self.map.removeLayer( self.Aggregator );
                    delete self.Aggregator;
                    
                  }
                  app.closeDialog();

                  if(app.stream)app.stream.layer.destroy();

                  //hide remove reset - what
                  app.map._layers.streamingLayer.hide();
                  app.map.removeLayer(app.map._layers.streamingLayer)
                  app.layers = [];

                  //TODO move these destroys
                  // CHELM: this are messing with 'edit stream'
                    dojo.byId('creator').style.display = "block"
                    dijit.byId( 'timeSlider' ).destroy( true );

                    //hide everything
                    dojo.byId('map-controls').style.display = "none";
                    dojo.byId('about-this-map').style.display = "none";
                    dojo.byId('about_stream').style.display = "none";

                    dojo.byId('creator').style.display = "block";
        	}else if(e.keyCode===32){
        		if(self.extentChaged){
        			var extent = self.fullExtent;
        			self.extentChaged = false;
        		}
        		else{
        			var extent = new esri.geometry.Extent({"xmin":12955546.305461952,"ymin":4862839.537988162,"xmax":12960132.527159182,"ymax":4865445.5629213285,"spatialReference":{"wkid": 102100}});
        			self.extentChaged = true;
        		}
        		
            	self.map.setExtent(extent);
        	}
        });
      }

      if ( hash.stream && !hash.webmap ){
        dojo.byId('creator').style.display = "none";
        this.initLayer( hash.stream );
      } else {
        var creation = new CreationUI({app: this}, dojo.byId('creator'));
        creation.startup();
        /*creation.on('create', function(params) {
          dojo.removeClass('add-stream', 'active');
          dojo.removeClass('add-data', 'active');

          //TODO replace with option in UI
          params.db = null; //"dbtest"; //null

          //self.options.service.params = params;
          if ( self.Aggregator ){
            self.Aggregator.type = self.options.service.params.aggregate.type;
            self.Aggregator.attributes = self.options.service.params.aggregate.attributes;
            self.Aggregator.buildStyle(self.options.service.params.style, self.options.service.params.aggregate.empty_boundaries)
          }
          self.options.app = self;

          self.stream = new stream.TwitterStream( self.map, self.options );
          dojo.connect(self.stream, 'onLoad', function( obj ){
            self.layers.push( obj.layer );
            self.createSlider( obj.layer, (self.Aggregator) ? true : false, self.options.service.params );
            self.createStats(self.options.service.params);

            if ( self.options.service.params.db ) {
              if ( location.hash === "" ) {
                location.hash= "#stream/" + this.svc_name;
              } else {
                location.hash = location.hash + "/stream/" + this.svc_name;
              }
            }

          });
        });*/
      }

      /*
       * Add data init
       *
       */
      var addData = new AddDataUI({}, dojo.byId('creator-data'));
      addData.startup();

      // force a refresh on clicking newyork
      dojo.connect(dojo.byId('newyork'), 'click', function() {
    	var extent = new esri.geometry.Extent({"xmin":12955546.305461952,"ymin":4862839.537988162,"xmax":12960132.527159182,"ymax":4865445.5629213285,"spatialReference":{"wkid": 102100}});
    	self.map.setExtent(extent);
        //var url = location.origin + location.pathname + '#NewYork';
        //window.location.replace( url );
        //window.location.reload();
      });

      dojo.connect(dojo.byId('add-stream'), 'click', function() {
        dojo.addClass(this, 'active');
        dojo.removeClass('add-data', 'active');
        if (self.Aggregator) {
            self.map.removeLayer( self.Aggregator );
            delete self.Aggregator;
            //self.updateAggregator( self.Aggregator.options );
          }
          app.closeDialog();

          //app.stream.layer.destroy();

          //hide remove reset - what
          app.map._layers.streamingLayer.hide();
          app.map.removeLayer(app.map._layers.streamingLayer)
          app.layers = [];

          //TODO move these destroys
          // CHELM: this are messing with 'edit stream'
          dojo.byId('creator').style.display = "block"
          dijit.byId( 'timeSlider' ).destroy( true );

           //hide everything
          dojo.byId('map-controls').style.display = "none";
          dojo.byId('about-this-map').style.display = "none";
          dojo.byId('about_stream').style.display = "none";
          dojo.byId('creator').style.display = "block";
          dojo.byId('creator-data').style.display = "none";
          
      });

      dojo.connect(dojo.byId('add-data'), 'click', function() {
        dojo.addClass(this, 'active');
        dojo.removeClass('add-stream', 'active');
        dojo.byId('creator').style.display = "none";
        dojo.byId('creator-data').style.display = "block";
      });

      /*
       * Wipe old map and create new stream
       *
       */
      dojo.connect(dojo.byId('new_stream'), 'click', function() {
        if (self.Aggregator) {
          self.map.removeLayer( self.Aggregator );
          delete self.Aggregator;
          //self.updateAggregator( self.Aggregator.options );
        }
        app.closeDialog();

        app.stream.layer.destroy();

        //hide remove reset - what
        app.map._layers.streamingLayer.hide();
        app.map.removeLayer(app.map._layers.streamingLayer)
        app.layers = [];

        //TODO move these destroys
        // CHELM: this are messing with 'edit stream'
          dojo.byId('creator').style.display = "block"
          dijit.byId( 'timeSlider' ).destroy( true );

          //hide everything
          dojo.byId('map-controls').style.display = "none";
          dojo.byId('about-this-map').style.display = "none";
          dojo.byId('about_stream').style.display = "none";

          dojo.byId('creator').style.display = "block";
      });

      /*
       *
       * About controls
       *
       */
       dojo.connect(dojo.byId('about_stream'), 'click', function() {
         if (dojo.byId('about-this-map').style.display == "block") {
           dojo.byId('about-this-map').style.display = "none";
         } else {
           dojo.byId('about-this-map').style.display = "block";
         }
       });
    }

    this.parseHash = function(){
      var nvpair = {};
      var qs = window.location.hash.replace('#', '');
      var pairs = qs.split('/');
      for (var i=0; i< pairs.length; i++){
        nvpair[pairs[i]] = pairs[i+1];
        i = i + 1;
      }
      return nvpair;
    }


    // Add layers to the map and maintains a list of layers
    this.addLayer = function(layer, add){
      if (add) this.layers.push(layer);
      this.map.addLayer(layer);
    }

    this.addStreamLayer = function( name, options ){
        var self = this;

        var layer = new stream.StreamLayer( this.options.stream_service.host + '/' + name + '/FeatureServer/0?maxRecordCount=10000', {
          purgeOptions: { displayCount: 100000},
          socketUrl: this.options.socket_service
        });



        var renderer = new esri.renderer.SimpleRenderer(
          new esri.symbol.SimpleMarkerSymbol(esri.symbol.SimpleMarkerSymbol[ options.style.shape || "STYLE_CIRCLE"], 10,
          new esri.symbol.SimpleLineSymbol(esri.symbol.SimpleLineSymbol.STYLE_SOLID,
          new dojo.Color( options.style.stroke.color || "rgb(255, 255, 255)" ), 1),
          new dojo.Color( options.style.fill || "rgb(5, 112, 176)" )
        ));

        layer.setRenderer( renderer );
        this.map.addLayer( layer );

        dojo.connect(layer, 'onLoad', function( obj ) {
          self.layers.push( layer );
          self.createSlider( layer, (self.Aggregator) ? true : false, options );
        });

        //dialog
        dojo.connect( layer, "onMouseOver", function( e ) {
          var a = e.graphic.attributes;
          var tmpl;
          if (a.content_type == "wikipedia_user" || a.content_type == "wikipedia_page") {
            tmpl = '<div>\
              <span id="username">Location Type: '+(a.content_type == "wikipedia_user" ? "User" : "Page")+' </span>\
              <span class="single-tweet-text">Subject: '+a.payload_subject+' ('+a.payload_channel+')</span>\
              <span class="single-tweet-text">Edit: '+a.content+'</span>\
              <span class="single-tweet-time">'+new Date(a.created_at).toLocaleString()+'</span>\
            </div>';
          } else {
            tmpl = '<div>\
              <span id="username">@'+a.name+': </span>\
              <span class="single-tweet-text">'+self.parseURL(a.text)+'</span>\
              <span class="single-tweet-time">'+new Date(a.created_at).toLocaleString()+'</span>\
            </div>';
          }
          
          self.openDialog( e, tmpl );
        });
      }
	this.parseURL = function(text){
        return text.replace(/[A-Za-z]+:\/\/[A-Za-z0-9-_]+\.[A-Za-z0-9-_:%&~\?\/.=]+/g, function (url) {
            return '<a target="_blank" href="' + url + '">' + url + '</a>';
        });
	}
      
    this.openDialog = function(evt, content) { //count, tmpl, id, is_alert){
      this.closeDialog();

      dojo.empty(dojo.byId('static-infowindow'));
      dojo.byId('static-infowindow').style.display = 'block';
      dojo.create('span', {id: "info-count", innerHTML: content}, 'static-infowindow')

    }


    // closes info windows on mouseout
    this.closeDialog = function() {
      dojo.byId('static-infowindow').style.display = 'none';
      var widget = dijit.byId("tooltipDialog");
      if (widget) {
        widget.destroy();
      }
    }


    this.initLayer = function(id){
      var self = this;
      this.socialAPI.stream( 'read', {id: id}, function( err, stream ){
          if ( err ){
            console.log('Error reading the social stream', err);
          } else if ( stream ) {
            // TODO add logic to support aggregation types
            self.addStreamLayer( stream.name, {style: { stroke: {} }});
          }
        });

       /*this.layer = stream.StreamLayer( "/admin/services/" + id + '/FeatureServer/0?maxRecordCount=100', {
          "id": 'streamingLayer',
          "outFields": ["*"]
       });

       this.map.addLayer( this.layer );
       dojo.connect(self.layer, "onMouseOver", function(evt) {self.openDialog(evt)});
       dojo.connect(self.layer, "onMouseOut", function(evt) {self.closeDialog(evt)});

       dojo.connect(this.layer, 'onLoad', function() {
         var layer = this;
         setTimeout(function(){
           if (!layer.graphics.length){
             setTimeout(arguments.callee, 25);
             return;
           }
           self.layers = [];
           self.layers.push(layer)
           self.createSlider(layer, false, null);
         }, 0)
       });*/
    }

    this.createSlider = function( layer, is_aggregation, options ) {
      var self = this;
      $('#map-controls').show();
      $('#bottom-div').show();

      dojo.create("div", { id: 'timeSlider', style: "margin-bottom:10px; bottom:33px" }, 'bottom-div');

      if (options) {
        var color = options.style.colors ? options.style.colors[options.style.colors.length - 2] : options.style.fill;
      }
      var mode = (is_aggregation) ? "show_all" : "show_partial";
      var params = {
        app : this,
        layers : self.layers,
        mode: mode,
        el: dojo.byId('timeSlider'),
        color: color
      }

      var slider = new stream.TimeSlider(params,dojo.byId('timeSlider'));
      this.map.setTimeSlider(slider);


      if ( is_aggregation ){
        dojo.connect( this.map.timeSlider, 'onExtentChange', function( obj ){
          self.Aggregator.slice( app.map.timeExtent.startTime.getTime(), app.map.timeExtent.endTime.getTime(), null, function( agg, total ){
            self.Aggregator.updateData( agg, total );
          });
        });
      }
    }

    this.createLayersPalette = function(params) {
      //var lyrs = new modules.LayersPalette({}, dojo.byId('layers-div'));
      //lyrs.startup(this.layers, params);
    }

    this.createStats = function(params) {
      var color;
      if (params.style.colors) {
        color = params.style.colors[params.style.colors.length - 2]
      }
      var stats = new modules.Stats({}, dojo.byId('stats-div'));
      stats.startup(this.layers, params, color);
    }

    this.createAbout = function(params) {
      var about = new modules.About({}, dojo.byId('about-this-map'));
      about.startup(this.layers, params);
      dojo.byId('about_stream').style.display = "block";
    }

    this.updateAggregator = function( option ){
        if ( this.Aggregator ){
          // remove the aggregator
          this.map.removeLayer( this.Aggregator );
        }

        app.boundary = app.boundaries[ option.aggregate.boundary ];
        // Init aggregator
        var options = {
            layer: {
              url: app.boundary.url,
              params : {
                boundary: option.aggregate.boundary,
                type: option.aggregate.type,
                zoomToExtent: app.boundary.zoomToExtent,
                geojson: app.boundary.geojson,
                key: app.boundary.key,
                //styles: app.boundary.styles,
                attrs: [
                  { key: 'id', value: function(d){ 
                	  return 'path'+d.properties[app.boundary.key];}},
                  { key: 'class', value: 'agg' }
                ]
              }
            }
        }

        // The Aggregator handles our polygon layer aggregation and rendering
        this.Aggregator = new modules.AggregationLayer( options.layer.url, options.layer.params );
        this.Aggregator.breaks = option.style.breaks;
        this.Aggregator.class_type = option.style.classificationType;
        this.Aggregator.buildStyle( option.style, true );
        // create a style element with css classes
        //this.Aggregator.buildStyle( null, true );
        this.addLayer( this.Aggregator, false);
    }

  }
  window.app = new Application();
  window.app.init();
})
