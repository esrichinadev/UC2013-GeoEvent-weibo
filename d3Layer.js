dojo.provide("modules.d3Layer");
dojo.require("esri.layers.graphics");

dojo.declare("modules.d3Layer", esri.layers.GraphicsLayer, {

    constructor: function(url, options) {
      var self = this;
      //this.inherited(arguments); 

      this.url = url;
      this.options = options;
      if (options.projection) this._project = options.projection;
      this._styles = options.styles || [];
      this._attrs = options.attrs || [];
      this._events = options.events || [];

      this._path = options.path || d3.geo.path();
      this.path = this._path.projection( self._project );

      //this.converter = dojo.require("terraformer.arcgis"); 
     
      // load features
      this._load( options.geojson || false, function(){
        self._render();
        self.onLoad( self );
      });
    },

    // request features; if the url is geojson skip the esri requests
    _load: function( is_geojson, callback ){
      var self = this;
      if ( is_geojson ){
        d3.json( self.url, function( geojsons ){
          self.geojson = {'type': 'FeatureCollection', 'features': []};
          for (var i = 0; i < geojsons.features.length; i++){
        	  var f = geojsons.features[i];
        	  var geojson = {
        			  id: f.attributes[self.options.key],
        			  type: 'Feature'
        	  };
        	  var geometry = esri.geometry.webMercatorToGeographic( f.geometry );
        	  geojson.geometry = {type: 'Polygon', coordinates: geometry.rings};
        	  geojson.geometry_id = f.attributes[self.options.key];
              geojson.properties = f.attributes;
              geojson.properties.powcount = 0;
              geojson.properties.gridid = f.attributes[self.options.key];
              geojson.properties.count = 0;
              geojson.properties.wlq = 0.0;
              self.geojson.features.push( geojson );
          }
          //self.geojson = geojsons;
          self.bounds = d3.geo.bounds( self.geojson );
          self.loaded = true;
          callback && callback();
        });
      } else {
        esri.request({
          url: this.url,
          content: {
            f: "json"
          },
          handleAs: "json",
          callbackParamName: "callback"
        }).then( function( d ){
          self.geojson = {'type': 'FeatureCollection', 'features': []}

          for (var i = 0; i < d.features.length; i++){
            var f = d.features[i];
            var geojson = {
              type: 'Feature'
            };
            geojson.properties = f.attributes;

            var geometry = esri.geometry.webMercatorToGeographic( f );
            geojson.geometry = {type: 'Polygon', coordinates: geometry.rings}
            //console.log(geojson); //self.converter.parse(f));
            self.geojson.features.push( geojson );//self.converter.parse(f));
          }
          self.bounds = d3.geo.bounds( self.geojson );
          self.loaded = true;
          callback && callback();
        });
      }

    }, 

    _bind: function(map){
      this._connects = [];
      this._connects.push( dojo.connect( this._map, "onZoomEnd", this, this._reset ) );
      //this._connects.push( dojo.connect( this._map, "onPanEnd", this, this._reset ) );
    },

    _project: function(x){
       var p = new esri.geometry.Point( x[0], x[1] );
       var point = app.map.toScreen( esri.geometry.geographicToWebMercator( p ), app.map.spatialReference )
       return [ point.x, point.y ];
    },

    _render: function(){
      var self = this;
      var p = this._paths();
      
      p.data( this.geojson.features )
        .enter().append( "path" )
          .attr('d', self.path );

      this._styles.forEach(function( s, i ) { 
        self.style(s);
      });

      this._attrs.forEach(function( s, i ) {
        self.attr(s);
      });

      this._events.forEach(function( s, i ) {
        self.event(s);
      });

      this._bind();
    },

    style: function( s ){
      this._paths().style(s.key, s.value);
    },

    attr: function( a ){
      this._paths().attr(a.key, a.value);
    },

    event: function( e ){
      this._paths().on(e.type, e.fn);
    },

    _reset: function(){
      this._paths().attr('d', this.path)
    },

    _element: function(){
      return d3.select("g#" + this.id + "_layer");
    },

    _paths: function(){
      return this._element().selectAll( "path" );
    }


});