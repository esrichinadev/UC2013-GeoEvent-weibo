dojo.provide("modules.AggregationLayer");
dojo.require("modules.d3Layer");

dojo.declare("modules.AggregationLayer", modules.d3Layer, {

    constructor: function( url, options ) {
      var self = this;

      this.type = options.type;
      this.max = 0 //(options.type == 'wlq') ? 0.0016 : 275;

      this.lq = {
        totaln: 1465,
        totalglobal: 55295,
        alert_level: 0.15,
        counts: {}
      }

      // RTree index for feature bounds
      this.RTree = dojo.require("terraformer.rtree");
      this.index = new this.RTree.RTree();

      // an aggregation hash - spatio-temporal counters by polygon id
      this.agg_hash = {};

      // init a classification scale
      this.total = 0;
      this.breaks = 5;
      this.class_type = 'quantile';
      this.upScale( this.max ); 

      this.attributes = options.attributes;
      
      dojo.connect( this, "onLoad", function( lyr ) {
        if ( options.zoomToExtent ) {
          if ( options.boundary == "200 meter") {
            var newExtent = new esri.geometry.Extent({
              xmax: -8220801.781654811,
              xmin: -8246446.404644453,
              ymax: 4979933.922917169,
              ymin: 4969309.175985543,
              "spatialReference": { "wkid": 102100 }
            });
            app.map.setExtent( newExtent );

          } else if ( options.boundary == "1 km grid cells") {
            //app.map.setZoom( app.map.getZoom( ) + 1);
            var newExtent = new esri.geometry.Extent({
              xmax: -8175130.65725448,
              xmin: -8277709.149213048,
              ymax: 4990615.997620008,
              ymin: 4948117.009893508,
              "spatialReference": { "wkid": 102100 }
            });
            app.map.setExtent( newExtent );
          } else {
            var newExtent = new esri.geometry.Extent({
              "xmin":lyr.bounds[0][0],
              "ymin":lyr.bounds[0][1],
              "xmax":lyr.bounds[1][0],
              "ymax":lyr.bounds[1][1],
              "spatialReference": { "wkid":4326 }
            });
            app.map.setExtent( esri.geometry.geographicToWebMercator(newExtent) );

          }
        }

        self.buildIndex();
        d3.selectAll('path')
          .on('mouseover', function( e ){
            if (this.getAttribute('data-count')){
              var is_alert = false;
              var count = Math.round( this.getAttribute('data-count') * 1000 ) / 1000;
              if (self.type == 'wlq'){
                if (this.getAttribute('data-alert') == '1'){
                  is_alert = true;
                  var tmpl = '<span class="tweet-text">WLQ Normalization: </span> <b class="tweet-val"> '+ count +'</b>';
                  /*app.stream.tweet_track.tweets.forEach(function(t){
                    tmpl += '<div class="tweet"><b>'+t.user+'</b>:'+t.text+'</div>';
                  });*/
                } else {
                  var tmpl = '<span class="tweet-text">WLQ Normalization: </span> <b class="tweet-val"> '+count+' </b>';
                }
              } else {
                var tmpl = '<span class="tweet-text">Count: </span> <b class="tweet-val"> '+count+' </b>';
              }
              app.openDialog( e, tmpl); //Math.round( this.getAttribute('data-count') * 1000 ) / 1000, tmpl, this.id, is_alert);
            }
          })
          .on('mouseout', function(){
            app.closeDialog();
          });
      });

    },
  

    // updates the local scale for changes in max values/counts
    upScale: function( ){
      var range = [];
      for (var i=1; i< this.breaks + 1; i++){
        range.push(i+'');
      }
      this.scale = d3.scale[this.class_type]()
        .domain( [ 0, this.max ] )
        .range( range );
    },

    // updates states to reflect changes in data class scale
    updateData: function( agg, total ){
      var self = this;
      if ( this.type == 'wlq' ){
        var lq = {};
        this._paths().attr('data-class', function( d ){
          if (agg[ this.id ]){
            //var cnt = this.getAttribute('data-lqcount');
            //lq[ this.id ] = (( agg[ this.id ] / app.stream.Aggregator.lq.counts[ this.id ] || self.total ) * ( app.stream.Aggregator.lq.totaln / app.stream.Aggregator.lq.totalglobal )) * agg[ this.id ];
        	  lq[ this.id ] = (( agg[ this.id ] / self.total ) * ( app.Aggregator.lq.totaln / app.Aggregator.lq.totalglobal )) * agg[ this.id ];
        	  lq[ this.id ] = lq[ this.id ] * 100;
            if (lq[ this.id ] >= self.lq.alert_level){
              d3.select(this)
                .transition()
                .attr('data-alert', '1')
                .style('fill', '#F00')
                .style('stroke', '#F00')
                .style('stroke-width', '8').each("end",function() { 
                  d3.select(this).
                  transition()     
                  .style('stroke-width', '2')});
            } else {
              d3.select(this)
                .attr('data-alert', '0')
                .style('stroke', '#FFF')
                .style('stroke-width', '.5px')
            }
            d3.select(this).attr('data-count', lq[ this.id ] );
            return self.scale( lq[ this.id ] );
          }
        });
        //console.log(self.total, total, agg, lq)
      } else {
        this._paths()
          .attr('data-count', function() { 
        	  return agg[ this.id ] 
        	  })
          .attr('data-class', function( d ) {
            return (agg[ this.id ] == 0) ? null : self.scale( agg[ this.id ] );
          });
      }
    },

    // builds an RTree index for faster aggregation 
    buildIndex: function(){
      var self = this;
      this.geojson.features.forEach(function( f, i ){
        var bbox = d3.geo.bounds(f);
        var bounds = { x: bbox[0][0], y: bbox[0][1], w: Math.abs(bbox[0][0] - bbox[1][0]), h: Math.abs( bbox[0][1] - bbox[1][1]) }
        var id = (f[app.boundary.key]) ? f[app.boundary.key] : f.properties[app.boundary.key];
        self.index.insert( bounds, { id: id, geom: f.geometry});
        self.lq.counts[ id ] = f.properties.count;
      })
    },

    // adds a point to the agg_hash object
    add: function( point ){
      var self = this;
      this.total++;
      var d = new Date( point.attributes.created_at );
      d.setMilliseconds(0);

      var p = point.geometry; //esri.geometry.webMercatorToGeographic(point.geometry);
      var poly = this.index.search({ x: p.x, y: p.y, w: .00025, h: .00025 });
    
      if ( poly.length ){
        // loop over the polygons and test each polygon 
        for ( var i = 0; i < poly.length; i++ ){
          var inside = this.pip( {coordinates: [p.x, p.y]}, poly[i].geom )
          if ( inside ){
            
            // Aggregate data for polygon id and current time
            if (!this.agg_hash[ poly[i].id ]) this.agg_hash[ poly[i].id ] = {};
            if (!this.agg_hash[ poly[i].id ][ d.getTime() ]) {
              this.agg_hash[ poly[i].id ][ d.getTime() ] = {stats: {count : 1, wlq: 0, attrs: {}}};
              //this.agg_hash[ poly[i].id ][ d.getTime() ].stats.wlq = (( this.agg_hash[ poly[i].id ][ d.getTime() ].stats.count / app.stream.Aggregator.total) * ( app.stream.Aggregator.lq.totaln / app.stream.Aggregator.lq.totalglobal )) * this.agg_hash[ poly[i].id ][ d.getTime() ].stats.count;
              ///this.agg_hash[ poly[i].id ][ d.getTime() ].stats.wlq = (( this.agg_hash[ poly[i].id ][ d.getTime() ].stats.count / this.lq.counts[ poly[i].id ]) * ( app.stream.Aggregator.lq.totaln / app.stream.Aggregator.lq.totalglobal )) * this.agg_hash[ poly[i].id ][ d.getTime() ].stats.count;
              //this.agg_hash[ poly[i].id ][ d.getTime() ].stats.wlq = (( this.agg_hash[ poly[i].id ][ d.getTime() ].stats.count / this.lq.counts[ poly[i].id ]) * ( app.Aggregator.lq.totaln / app.Aggregator.lq.totalglobal )) * this.agg_hash[ poly[i].id ][ d.getTime() ].stats.count;
              this.agg_hash[ poly[i].id ][ d.getTime() ].stats.wlq = (( this.agg_hash[ poly[i].id ][ d.getTime() ].stats.count / app.Aggregator.total) * ( app.Aggregator.lq.totaln / app.Aggregator.lq.totalglobal )) * this.agg_hash[ poly[i].id ][ d.getTime() ].stats.count;
              if (this.attributes){
                this.attributes.forEach(function( attr ){
                  self.agg_hash[ poly[i].id ][ d.getTime() ].stats.attrs[attr] = {min: 0, max: 0, median: 0, sum: 0};
                })
              }              
            } else {
              this.agg_hash[ poly[i].id ][ d.getTime() ].stats.count++;

              if (this.type == 'wlq'){ 
                //this.agg_hash[ poly[i].id ][ d.getTime() ].stats.wlq = (( this.agg_hash[ poly[i].id ][ d.getTime() ].stats.count / this.lq.counts[ poly[i].id ]) * ( app.stream.Aggregator.lq.totaln / app.stream.Aggregator.lq.totalglobal )) * this.agg_hash[ poly[i].id ][ d.getTime() ].stats.count;
            	  this.agg_hash[ poly[i].id ][ d.getTime() ].stats.wlq = (( this.agg_hash[ poly[i].id ][ d.getTime() ].stats.count / app.Aggregator.total) * ( app.Aggregator.lq.totaln / app.Aggregator.lq.totalglobal )) * this.agg_hash[ poly[i].id ][ d.getTime() ].stats.count;
            	  ///this.agg_hash[ poly[i].id ][ d.getTime() ].stats.wlq = (( this.agg_hash[ poly[i].id ][ d.getTime() ].stats.count / this.lq.counts[ poly[i].id ]) * ( app.Aggregator.lq.totaln / app.Aggregator.lq.totalglobal )) * this.agg_hash[ poly[i].id ][ d.getTime() ].stats.count;
            	  //console.log(this.agg_hash[ poly[i].id ][ d.getTime() ].stats.wlq, this.agg_hash[ poly[i].id ][ d.getTime() ].stats.count, app.stream.Aggregator.total, app.stream.Aggregator.lq.totaln, app.stream.Aggregator.lq.totalglobal)
              }

              // Calculate Stats 
              if (this.attributes){
                this.attributes.forEach(function( attr ){
                  if (self.agg_hash[ poly[i].id ][ d.getTime() ].stats.attrs[attr]){
                    var hash_attr = self.agg_hash[ poly[i].id ][ d.getTime() ].stats.attrs[attr];
                    if (point.attributes[ attr ] < hash_attr.min ){
                      hash_attr.min = point.attributes[ attr ];
                    }
                    if (point.attributes[ attr ] > hash_attr.max ){
                      hash_attr.max = point.attributes[ attr ];
                    }
                    hash_attr.median = ( hash_attr.max + hash_attr.min ) / 2;
                    hash_attr.sum += point.attributes[ attr ];
                  }
                })
              }

            }
            
            this.agg_hash[ poly[i].id ][ d.getTime() ].stats.wlq = this.agg_hash[ poly[i].id ][ d.getTime() ].stats.wlq * 100;

            // if max goes up we need to adjust our scales
            //if ( this.agg_hash[ poly[i].id ][ d.getTime() ].stats.count > this.max ) {
            //  this.max = this.agg_hash[ poly[i].id ][ d.getTime() ].stats.count;
            //  this.upScale();
            // }
            //var extent = app.map.timeSlider.maxTimeExtent;
            /*var total = 0;
            for ( var t in this.agg_hash[ poly[ i ].id ] ){
              total += this.agg_hash[ poly[ i ].id ][t].stats.count;
            }*/

            var count = null;
            if ( app.map.timeSlider.fullTimeExtent ){
              //var min = app.map.timeExtent.startTime.getTime(),
                //max = app.map.timeExtent.endTime.getTime();
              var min = Date.parse(app.map.timeSlider.fullTimeExtent[0]),
              max = Date.parse(app.map.timeSlider.fullTimeExtent[1]);

              for (var time in self.agg_hash[ poly[i].id ]){
                if (time <= max && time >= min){
                  count += (self.type == 'wlq') ? self.agg_hash[ poly[i].id ][ time ].stats.wlq : self.agg_hash[ poly[i].id ][ time ].stats.count;
                }
              }

              if ( count > this.max ) {
                this.max = count;
                this.upScale();
              }

              d3.select( 'path#path' + poly[i].id )
                .attr('data-count', count )
                .attr('data-class', (count != 0) ? self.scale( count ): null);
            }
          }
        }
      }
    },

    // returns an aggregation slice of data that 
    slice: function( min, max, id, callback ){
      var data = {};
      var total = 0;
      if ( id ){
        data[id] = 0;
        for (var time in this.agg_hash[ id ]){
          if (time <= max && time >= min){
            data[id] += this.agg_hash[ id ][ time ].stats.count;
            total++;
          }
        }
      } else {
        for ( var k in this.agg_hash ){
          data[ 'path' + k ] = 0;
          for (var time in this.agg_hash[ k ]){
            if (time <= max && time >= min){
              data[ 'path' + k ] += this.agg_hash[ k ][ time ].stats.count;
              total++;
            }
          }
        }
      }
      callback && callback( data, total );
      return data;
    },

    // Simple Point in Polygon
    pip: function ( point, polygon ) {
      if (point.coordinates && polygon.coordinates){
        var x = point.coordinates[1],
          y = point.coordinates[0],
          poly = polygon.coordinates[0];
        for (var c = false, i = -1, l = poly.length, j = l - 1; ++i < l; j = i) {
          var px = poly[i][1],
            py = poly[i][0],
            jx = poly[j][1],
            jy = poly[j][0];
          if (((py <= y && y < jy) || (jy <= y && y < py)) && (x < (jx - px) * (y - py) / (jy - py) + px)) {
            c = [point];
          }
        }
        return c;
      } else {
        return false;
      }
    },

    styleClass: function(category, color, stroke, strokewidth, opacity){
      var str = 'path[data-class = "'
        str += category + '"]{ fill: '
        str += color + '; opacity: '
        str += opacity + '; stroke: '
        str += stroke + '; stroke-width:'
        str += strokewidth +'; }';
      return str;
    },

    buildStyle: function( style, empty ){
      var style_str = (empty) ? '.agg{ fill: rgb(125,125,125); opacity: .25; stroke-width: .5pxpx; stroke: #DDD; }' : ' .agg{ opacity: 0;}';
      if ( style ){
        for (var i=0; i < style.breaks; i++){
          style_str += this.styleClass( i+1, style.colors[i], style.stroke.color || 'rgb(255, 255, 255)', .5, style.opacity );
          //style_str += this.styleClass( i+1, style.colors[i], style.stroke.color || 'rgb(255, 255, 255)', style.stroke.width || .5, style.opacity );
        }
      }
      d3.select('body').append('style')
        .attr('id', 'aggregation-style')
        .text(style_str);
    }


});