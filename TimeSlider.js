define([
  "dojo/_base/declare",
  "dojo/_base/lang",
  'dojo/_base/connect',
  'dojo/_base/array',
  'dojo/query',
  'dojo/dom',
  'dojo/_base/html',
  "dojo/dom-class",
  "dojo/dom-construct",  
  'dojo/dom-style',
  "dojo/dom-geometry",
  "dojo/require", 
  "dojox/gfx",
  "dojox/gfx/fx",
  "dojox/gfx/shape",
  "dijit/_WidgetBase",
  "dijit/_TemplatedMixin",
  "dijit/form/Slider",
  "dojox/form/RangeSlider",
  "dojo/Evented",
  "dojo/on",
  "dojo/dom-attr"
],

/**
  TimeSlider

  Constructor Params:
    params - 
      required: layers ( array of layers to be used in the TimeSlider )
      optional: mode ( show_all, show_partial ), defaults to show_partial
                color ( sets theme for slider )
                
    element - element for dijit to append to in app

*/

function(declare, lang, conn, arr, query, dom, html, domClass, domConstruct, domStyle, domGeometry, 
  require, gfx, fx, gfxShape, WidgetBase, TemplatedMixin, Slider, RangeSlider, Evented, on, domAttr) {
  var TimeSlider = declare("stream.TimeSlider", [WidgetBase, TemplatedMixin], {
    widgetsInTemplate: true,
    templatePath: location.pathname.replace(/\/[^/]+$/, '') + dojo.moduleUrl("/templates", "timeSlider.html"),
    basePath: dojo.moduleUrl("dijit"),
    
    constructor: function(params, element) {
      var self = this;
      this.app = params.app;
      this.layers = params.layers;
      this.element = element;
      this.bins = [];
      this.fullTimeExtent = this.getFullTimeExtent();
      this._mode = params.mode || "show_partial"; //"show_partial"; show_all
      this._resolution = "esriTimeUnitsSeconds";
      this._max_bins = 400;
      this._prev_num_bins = 0; 
      this._max_bin_height = 0;
      this._color = params.color || "rgb(5, 112, 176)";
      this._active = false;
      this.is_streaming = false;
      this.load_count = 0;
      this._wire();
      
      this._resolutions = {
        "esriTimeUnitsSeconds"  : [ 0 ],
        "esriTimeUnitsMinutes"  : [ 0 ],
        "esriTimeUnitsHours"    : [ 0 ],
        "esriTimeUnitsDays"     : [ 0 ],
        "esriTimeUnitsMonths"   : [ 0 ],
        "esriTimeUnitsYears"    : [ 0 ]
      }
      
      //build initial histogram, bind streaming layers
      this.layers.forEach(function( layer ){
        var handle = conn.connect( layer, "onUpdateEnd", function() {
          conn.disconnect( handle );
          self.fullTimeExtent = self.getFullTimeExtent();
          
          if ( layer.declaredClass.match(/StreamLayer/g) ) {
           self._bindStreamingEvents( layer );
          }
          
          if ( layer.graphics ) {
            self.updateLength = layer.graphics.length;
            for ( var i = 0, li = layer.graphics.length; i < li; i++ ) {
              var time = layer.graphics[ i ].attributes[ layer.timeInfo.startTimeField ];
              self._add( time );
            }
          }
        });
      });
    },
    
    /*
     * Returns max time extent of all time enabled layers on the map
     * 
     * 
     */
    getFullTimeExtent: function() {
      var min = null,max =null;
      for (var i=0,li=this.layers.length;i<li;i++) {
        if (this.layers[i].timeInfo.timeExtent.startTime) { //new streaming layers this is null
          var start = this.layers[i].timeInfo.timeExtent.startTime.getTime();
          var end = this.layers[i].timeInfo.timeExtent.endTime.getTime(); 
          if ( !min ) {
            min = start;
            max = end;  
          } else if ( min > start ) {
            min = start;
          } else if ( max < end ) {
            max = end;
          }
        }
      }
      return [min, max];
    },
    
    /*
     * TODO remove this? Only in here because esri setTimeSlider requires this call
     */
    getCurrentTimeExtent: function() {
    },
    
    /*
     * Wire general events
     * 
     * 
     */
    _wire: function() {
      var self = this;
      
      //not active when mouse up
      conn.connect(dom.byId('map'), "onmouseup, blur", function() {
        if (self._active && ( self.bins.length != self._prev_num_bins)) {
          self._active = false;
          self._prev_num_bins = self.bins.length;
          self._drawHistogram();  
          self._updateSlider();
        }
      });
      
      //TODO address race condition
      setTimeout(function() {
        conn.connect(dom.byId('histogram-back'), 'click', function() {
          self._getPaginateStep( 'back' );
        });
      },0);
      
      //TODO address race condition
      setTimeout(function() {
        conn.connect(dom.byId('histogram-forward'), 'click', function() {
          self._getPaginateStep( 'forward' );
        });
      },0);
      
    },
    
     /*
     * Bind streaming layers
     * 
     */
    _bindStreamingEvents: function(layer) {
      var self = this;
      conn.connect( layer, 'onMessage', function(m) {
        self.is_streaming = true;
        var time = m.graphic.attributes[ this.timeInfo.startTimeField ];
        self._add( time );
      });
      conn.connect( layer, 'onRemove', function(m) {
        self.is_streaming = true;
        var time = m.graphic.attributes[ this.timeInfo.startTimeField ];
        if ( self._mode == 'show_partial' ) self._remove( time );
      });
    },
    
    /*
     * Find the next best resolution
     * 
     */
    _nextRes: function(){
      for ( res in this._resolutions ) {
        if ( this._resolutions[res].length <= this._max_bins) return res;
      }
    },
    
    /*
     * Maintains counts for all resolutions (sec, min, hour, day, month)
     * 
     */
    _updateAllResolutions: function( seconds, remove ) {
      var self = this,
        min = Math.floor( seconds / 60 ),
        hour = Math.floor( seconds / (60*60) ),
        day = Math.floor( seconds / ( 60*60*24 ) );
      
      //MINUTES
      var diff_mins = min < 0? min * -1 : ( min - this._resolutions[ "esriTimeUnitsMinutes" ].length );
      if ( diff_mins >= 1 ) {
        for (var i = 0; i<diff_mins; i++) {
          if(min < 0){
        	  this._resolutions[ "esriTimeUnitsMinutes" ].splice(0, 0, 0);
          }else{
        	  this._resolutions[ "esriTimeUnitsMinutes" ].push(0);
          } 
        }
      }
      if(min < 0)
    	  this._resolutions[ "esriTimeUnitsMinutes" ][ 0 ]++;
      else
    	  !remove ? this._resolutions[ "esriTimeUnitsMinutes" ][ min ]++ : this._resolutions[ "esriTimeUnitsMinutes" ][ min ]--;
      
      //HOURS
      var diff_hours = hour < 0 ? hour * -1 : ( hour - this._resolutions[ "esriTimeUnitsHours" ].length );
      if ( diff_hours >= 1 ) {
        for (var i = 0; i<diff_hours; i++) {
        	if(hour < 0)
        		this._resolutions[ "esriTimeUnitsHours" ].splice(0, 0, 0);
        	else
        		this._resolutions[ "esriTimeUnitsHours" ].push(0);
        }
      }
      if(hour < 0)
    	  this._resolutions[ "esriTimeUnitsHours" ][ 0 ]++;
      else
    	  !remove ? this._resolutions[ "esriTimeUnitsHours" ][ hour ]++ : this._resolutions[ "esriTimeUnitsHours" ][ hour ]--;
        
      //DAYS
      var diff_days = day < 0? day * -1 : (day - this._resolutions[ "esriTimeUnitsDays" ].length);
      if( diff_days >= 1){
    	  for(var i = 0; i<diff_days; i++){
    		  if(day < 0)
    			  this._resolutions[ "esriTimeUnitsDays" ].splice(0, 0, 0);
    		  else
    			  this._resolutions[ "esriTimeUnitsDays" ].push(0); 
    	  }
      }
      if(day < 0)
    	  this._resolutions[ "esriTimeUnitsDays" ][ 0 ]++;
      else
    	  !remove ? this._resolutions[ "esriTimeUnitsDays" ][ day ]++ : this._resolutions[ "esriTimeUnitsDays" ][ day ]--;   
      
      //set bins and update histogram
      if ( this._resolutions[ this._resolution ].length >= this._max_bins ) 
    	  this._resolution = this._nextRes();
      
      var index;
      switch (this._resolution) {
        case "esriTimeUnitsSeconds" :
          index = seconds < 0? 0 : seconds;
          this._numeric_res = 1000;
          break;
        case "esriTimeUnitsMinutes" : 
          index = min < 0? 0 : min;
          this._numeric_res = 60000;
          break;
        case "esriTimeUnitsHours" : 
          index = hour < 0? 0 : hour;
          this._numeric_res = 3600000;
          break;
        case "esriTimeUnitsDays" : 
          index = day < 0? 0 : day;
          this._numeric_res = 8640000;
          break;
      }
      
      this._setBins( index );
    },
   
    /*
     * 
     * Sets bins used by slider based on current resolution
     * 
     * 
     */
    _setBins: function( index ) {
      this.bins = this._resolutions[ this._resolution ];
      var start = 0;
       
      var i = 0; 
      while (this.bins[i] == 0) {
        start = i + 1;
        i = i + 1;
      } 
      
      //update the slider
      if ( this._active ) {
        //do not update the slider if it is being used
        if (start != this.minVisibleIndex) this.minVisibleIndex = start; 
        return;
      } else {
        if (!this.is_steaming && this.updateLength == this.load_count) {
          
          //hide loading indicators
          dom.byId('histogram-forward-icon-loading').style.display = "none";
          dom.byId('histogram-forward-icon').style.display = "block";
          dom.byId('histogram-backward-icon-loading').style.display = "none";
          dom.byId('histogram-backward-icon').style.display = "block";
         
          if ( ( this.bins.length != this._prev_num_bins) || (start != this.minVisibleIndex) ) {
            this.minVisibleIndex = start;
            this._prev_num_bins = this.bins.length;
            this._drawHistogram();
            if (this._slider) this._updateSlider();
          } else {
            this._updateHeights( index );
          }
        } else {
          if ( ( this.bins.length != this._prev_num_bins) || (start != this.minVisibleIndex) ) {
            this.minVisibleIndex = start;
            this._prev_num_bins = this.bins.length;
            this._drawHistogram();
            if (this._slider) this._updateSlider();
          } else {
            this._updateHeights( index );
          }
        }
      } 
      
    },
    
    
    /*
     * Update Time Extents
     * 
     * 
     */
    _updateFullTimeExtent: function( time ) {
      
      if ( !this.fullTimeExtent[0] ) this.fullTimeExtent[0] = time;
      if ( time < this.fullTimeExtent[0] ) {
        this.fullTimeExtent[0] = time;
      };
      if ( time > this.fullTimeExtent[1] ) {
        this.fullTimeExtent[1] = time;
      };
    },
    
    /*
     * Get bin index for any given time
     * 
     */
    _getBin: function( time ) {
      if(this.fullTimeExtent[0] == null)return 0 ;
      var index = Math.floor( ( time - this.fullTimeExtent[0] ) / 1000 );
      return index;
    },
    
    
    /*
     * Add
     * Increments corresponding bin count
     * 
     */
    _add: function( time ) {
      time = new Date(Date.parse(time));
      
      var index = this._getBin( time );
      var diff = 0;
      if(index < 0){
    	  diff = index * -1;
      }
      else{
    	  diff = (index - this._resolutions[ "esriTimeUnitsSeconds" ].length);
      }
      
      //fill is missing bins with ZERO
      if (diff >= 1) {
    	  if(index < 0 ){
    		  for(var i = 0; i<diff; i++){
    			  this._resolutions[ "esriTimeUnitsSeconds" ].splice(0, 0, 0);
    		  }
    	  }
    	  else{
    		  for (var i = 0; i<diff; i++) {
    	          this._resolutions[ "esriTimeUnitsSeconds" ].push(0);
    	       }
    	  }
      }
      if(index < 0){
    	  this._resolutions[ "esriTimeUnitsSeconds" ][ 0 ] = 1;
      }
      else if (!this._resolutions[ "esriTimeUnitsSeconds" ][ index ]) {
        this._resolutions[ "esriTimeUnitsSeconds" ][ index ] = 1;
      } else {
        this._resolutions[ "esriTimeUnitsSeconds" ][ index ]++;
      }
      
      this._updateAllResolutions( index );
      this._updateFullTimeExtent( time );
      if (!this._slider) {
        this._creatSlider();
      }
    },
    
    /*
     * Remove
     * (de)Increments corresponding bin count 
     * 
     */
    _remove: function( time ) {
      var index = this._getBin( time );
      this._resolutions[ "esriTimeUnitsSeconds" ][ index ]--;
      this._updateAllResolutions( index, true );
      if ( !this._active ) this._updateSlider();
    },
    
    /*
     * 
     * Build initial slider
     * Creates dojo slider for interaction with histogram
     * 
     */
    _creatSlider: function() {
      var self = this;
      this._slider = new dojox.form.HorizontalRangeSlider({
        name: 'histogram-slider',
        values: [0, 100],
        minimum: 0,
        maximum: 100,
        showButtons: false,
        intermediateChanges: true,
        discreteValues: 2,
        style: "width:100%",
        onChange: function(values){
          var min = Math.floor(values[0]);
          var max = Math.floor(values[1]);
          self._getUserExtents(min, max);
          self._disableBins(min, max);
        }
      }, "histogram-slider");
      
      conn.connect(this._slider.sliderHandleMax, 'mousedown', function() { 
        self._active = true;
      });
      
    },
    
    /*
     * 
     * Update slider
     * Update slider values when points are added and removed
     * 
     */
    _updateSlider: function() {
      this._slider.discreteValues = this.histogram.length + 1;
      this._slider.maximum = this.histogram.length;
      this._slider._setValueAttr([0, this.histogram.length], false, false);
    },
    
    /*
     * Figure out user defined extents; fire event!
     * 
     * 
     */
    _getUserExtents: function(min, max) {
      var timeExtent = new esri.TimeExtent();
      timeExtent.startTime = new Date(Date.parse(this.fullTimeExtent[0]) + ((min + this.minVisibleIndex) * this._numeric_res));
      timeExtent.endTime = new Date(Date.parse(this.fullTimeExtent[0]) + ((max + this.minVisibleIndex) * this._numeric_res));
      this._visibleTimeExtent = timeExtent;
      this._updateDateRange( timeExtent );
      this.onExtentChange( timeExtent );
      this._updatePagination( timeExtent );
    },
    
    /*
     *  Page Forward
     *  Calculate timeExtent to send to  
     * 
     */
    _getPaginateStep: function( direction ) {
      
      var timeExtent = this._visibleTimeExtent;
      var step = ((Date.parse(this.fullTimeExtent[ 1 ]) - Date.parse(this.fullTimeExtent[0])) / 3) //timeExtent.endTime.getTime() - timeExtent.startTime.getTime();
      if ( direction === "forward" ) {
        dom.byId('histogram-forward-icon-loading').style.display = "block";
        dom.byId('histogram-forward-icon').style.display = "none";
      } else {
        dom.byId('histogram-backward-icon-loading').style.display = "block";
        dom.byId('histogram-backward-icon').style.display = "none";
      }
      
      //this._requestFeatures ( timeExtent, direction );
    },
    
    /*
     * 
     * Query features out of range
     * 
     */
    _requestFeatures: function( timeExtent, direction ) {
      /*var self = this;
      this.is_steaming = false; 
      this.load_count = 0;
      
      //reset the resolutions
      this._resolutions = {
        "esriTimeUnitsSeconds"  : [ 0 ],
        "esriTimeUnitsMinutes"  : [ 0 ],
        "esriTimeUnitsHours"    : [ 0 ],
        "esriTimeUnitsDays"     : [ 0 ],
        "esriTimeUnitsMonths"   : [ 0 ],
        "esriTimeUnitsYears"    : [ 0 ]
      }
      
      var i = 0,
        requests = this.layers.length,
        cnt = 0,
        lyr = 0;
      
      //query features for each time enabled layer
      while (i <= requests - 1) {

        var url = this.layers[ i ]._url.path;
        var queryTask = new esri.tasks.QueryTask(url);
        
        var query = new esri.tasks.Query();
        query.returnGeometry = true;
        query.outFields = ['*'];
        if ( direction === "forward" ) {
          //query.where = "posted_time > "+ timeExtent.endTime.getTime()+"&maxRecordCount=200";
          query.where = "posted_time > "+ timeExtent.endTime.getTime()+"";
        } else {
          query.where = "posted_time < "+ timeExtent.startTime.getTime()+"";
        }
        
        //execute task; clear existing features, add new graphics to layer
        queryTask.execute( query, function( featureSet, layer ) {
          var features = featureSet.features;
          self.layers[ lyr ].clear();
          
          self.updateLength = features.length;
          for(var i = 0, il = features.length; i<il; i++) {
            var point = {
              "geometry" : { "x" :features[i].geometry.x, "y" : features[i].geometry.y, "spatialReference" : {"wkid":4326} },
              "attributes": features[ i ].attributes
            };
            var graphic = new esri.Graphic( point );
            
            self.load_count++;
            self._add( graphic.attributes[ self.layers[ lyr ].timeInfo.startTimeField ] )
            self.layers[ lyr ].add( graphic );
          }
          lyr++;
        });
        i = i + 1
      }*/
    },
       
    /*
     * Show pagination when full time extent != to user time extent
     * 
     */   
    _updatePagination: function( timeExtent ) {
      
      //back button
      if ( timeExtent.startTime.getTime() > this.fullTimeExtent[ 0 ] ) {
        domAttr.remove('histogram-back', 'disabled');
      } else {
        domAttr.set('histogram-back', 'disabled', true);
      }
      
      //forward button
      if ( timeExtent.endTime.getTime() < this.fullTimeExtent[ 1 ] ) {
        domAttr.remove('histogram-forward', 'disabled');
      } else {
        domAttr.set('histogram-forward', 'disabled', true);
      }   
       
    },
     
     
    /*
     * Draw Histogram
     * Creates initial histogram, redraws histogram when bin is added or removed
     * 
     */
    _drawHistogram: function() {
      var self = this,
        ticks = [];
      
      if ( this.histogramSurface ) {
        this.histogramSurface.clear();
      } else {
        this.histogramSurface = dojox.gfx.createSurface("histogram-container", dom.byId(this.element.id).offsetWidth, 100);  
      }
      
      var max = Math.max.apply(Math, this.bins),
        width = (this.histogramSurface._parent.clientWidth / (this.bins.length - this.minVisibleIndex)),
        gap = width / 10,
        x = 0;
        
      this.histogram = [];
      for ( var i = this.minVisibleIndex, li = this.bins.length; i < li; i++ ) {
        var height = ( this.bins[ i ] / max ) * 100;
        var y = ( 100 - height );
       
        var bar = this.histogramSurface.createRect( { x: x, y: y, width: width - gap, height: height } )
          .setFill(this._color);
        
        this.histogram.push( bar );
        x = x + width;
        ticks.push( x );
        
        //tooltips
        bar.bin = this.bins[i];
        bar.x = x - width;
        bar.num = i;
        bar.max = max;
        bar.connect('onmouseenter', bar, function() {
          self._showTipForBin( this.bin, this.num, this.x );
        });
        bar.connect('onmouseleave', bar, function() {
          self._hideTipForBin();
        });
      }
      
      this._updateTimeTicks( ticks )
      this._updateScaleBar( max );
    },
    
    /*
     * Update heights
     * Only called when existing bin values change, not when bin added or removed
     * 
     */
    _updateHeights: function( index ) {
      var max = Math.max.apply( Math, this.bins );
      
      if ( max != this._max_bin_height ) {
        for ( var i = this.minVisibleIndex, li = this.histogram.length; i < li; i++ ) {
          var height = ( this.bins[ i ] / max ) * 100;
          var y = 100 - height; 
          this.histogram[ i ].setShape( { y: y, height: height } );
        }
      } else {
        var height = ( this.bins[ index ] / max ) * 100;
        var y = 100 - height;
        this.histogram[ index - this.minVisibleIndex ].setShape({ y: y, height: height });
      }
      
      this._updateScaleBar( max );
      this._max_bin_height = max;
    },
    
    
    /*
     * Maintains x time ticks
     * 
     * 
     */
    _updateTimeTicks: function( ticks ) {
      var step = Math.floor(this.histogram.length / 3);
      
      for (i=0;i<2;i++){
        var start = (this._mode === "show_partial") ? 0 : this.minVisibleIndex;
        var num = this.minVisibleIndex + (step + 1);
        
        this.histogramSurface.createLine({ x1: ticks[step], y1: 0, x2: ticks[step], y2:this.histogramSurface._parent.clientHeight }).setStroke("rgb(200, 200, 200)");
        date =  new Date(Date.parse(this.fullTimeExtent[0]) + (num * this._numeric_res)).toLocaleString();
        
        this.histogramSurface.createText({ x: ticks[step] + 2, y: 10, text: date} ).setFont( { size : "12px"} ).setFill("rgb(82, 95, 109)");
        step = step + step;
      }
        
    },
    
    /*
     * Updates time extent helper in UI
     * 
     */
    _updateDateRange: function( timeExtent ) {
      var start = new Date(timeExtent.startTime).toLocaleString();
      var end = new Date(timeExtent.endTime).toLocaleString();
      dom.byId('histogram-range').innerHTML = '时间跨度: ' + start + ' - ' + end;
    },
    
    /*
     * Gray out histogram bins when out of view
     * Needs min max slider values
     * 
     */
    _disableBins: function( min, max ) {
      var self = this;
      
      if ( min == 0 && max == this.histogram.length ) {
        this.histogram[ this.histogram.length - 1 ].setFill( this._color );
        return;
      }
      
      this.histogram.forEach(function(bar,i) {
        if (i < min) { 
          bar.setFill("rgb(216,216,216)");
        } else if (i >= max ) {
          bar.setFill("rgb(216,216,216)");
        } else {
          bar.setFill( self._color );
        }
      });
    
    },
    
    /*
     * 
     * Draws scalebar, updates dynamically as data streams
     * 
     */
    _updateScaleBar: function(max) {
      if (this.scaleLeft) {
        this.scaleLeft.clear();
        this.scaleRight.clear();
      } else {
        this.scaleRight = dojox.gfx.createSurface('scale-bar-right', 45, 110);
        this.scaleLeft = dojox.gfx.createSurface('scale-bar-left', 45, 110);
      }
      
      var offset_max = (max > 99) ? offset = 10 : 20;
      var offset_mid = ((max / 2) > 99) ? offset_mid = 10 : 20;
      this.scaleLeft.createLine({ x1: 40, y1: 5, x2:40, y2:130 }).setStroke("rgb(82, 95, 109)");
      this.scaleLeft.createLine({ x1: 40, y1: 5, x2:37, y2:5 }).setStroke("rgb(82, 95, 109)");
      this.scaleLeft.createLine({ x1: 40, y1: 60, x2:37, y2:60 }).setStroke("rgb(82, 95, 109)");
      this.scaleLeft.createText({ x: offset_max, y: 10, text: max} ).setFont( { size : "14px"} ).setFill("rgb(82, 95, 109)");
      this.scaleLeft.createText({ x: offset_mid, y: 65, text: (Math.floor(max / 2))} ).setFont( { size : "14px" } ).setFill("rgb(82, 95, 109)");
      
      this.scaleRight.createLine({ x1: 0, y1: 5, x2:0, y2:130 }).setStroke("rgb(82, 95, 109)");
      this.scaleRight.createLine({ x1: 0, y1: 5, x2:3, y2:5 }).setStroke("rgb(82, 95, 109)");
      this.scaleRight.createLine({ x1: 0, y1: 60, x2:3, y2:60 }).setStroke("rgb(82, 95, 109)");
      this.scaleRight.createText({ x: 4, y: 10, text: max} ).setFont( { size : "14px"} ).setFill("rgb(82, 95, 109)");
      this.scaleRight.createText({ x: 4, y: 65, text: (Math.floor(max / 2))} ).setFont( { size : "14px"} ).setFill("rgb(82, 95, 109)");
    },
    
    
    /*
     * Show / hide histogram toolips
     * 
     */
    _showTipForBin : function( bin, cnt, x ) {
      
      var start = (this._mode === "show_partial") ? 0 : this.minVisibleIndex;
      var timeString = '';
      var time = new Date(Date.parse(this.fullTimeExtent[0]) + ((cnt - start) * this._numeric_res));
      switch (this._resolution) {
      	case "esriTimeUnitsSeconds" :
      		timeString = time.toLocaleString();
      		break;
      	case "esriTimeUnitsMinutes" : 
      		timeString = time.toLocaleString().substr(0,time.toLocaleString().length - 3);
      		break;
      	case "esriTimeUnitsHours" : 
      		timeString = time.toLocaleString().substr(0,time.toLocaleString().length - 6) + '时';
      		break;
      	case "esriTimeUnitsDays" : 
      		timeString = time.toLocaleString().substr(0,time.toLocaleString().length - 10);
      		break;
      } 
      dom.byId( "focusTip" ).innerHTML = ( '<span style="font-size:8pt">' + timeString +'</span> <br /> Count: ' + bin );
      
      domStyle.set( 'focusTip' , {
        'display' : 'block',
        'left': x + 'px',
        'top': '-10px'
      });
    },
    
    _hideTipForBin : function () {
      dojo.byId( "focusTip" ).style.display = "none";
    },
    
    /*
     * EVENTS
     * 
     * 
     */
    onTimeExtentChange: function() {
    },
    onExtentChange: function(){
        var timeExtent = new esri.TimeExtent();
        timeExtent.startTime = new Date(Date.parse(this.fullTimeExtent[0]));
        timeExtent.endTime = new Date(Date.parse(this.fullTimeExtent[1]));
    	app.map.timeExtent = timeExtent;
    	//console.log(app.map.timeExtent);
    }
    
  });
  
  return TimeSlider;
});