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
  "dijit/layout/AccordionContainer",
  "dijit/layout/ContentPane",
  "dojo/Evented",
  "dojo/on",
  "dojo/dom-attr"
],

/**
 * Creation
 * 
 * Constructor Params: params: none element: source node for appending dijit
 * 
 */


function(declare, lang, conn, arr, query, dom, html, domClass, domConstruct, domStyle, 
    domGeometry, require, gfx, fx, gfxShape, WidgetBase, TemplatedMixin, Slider, AccordionContainer, ContentPane, Evented, on, domAttr) {
  var StreamCreation = declare("stream.StreamCreation", [WidgetBase, TemplatedMixin], {
    widgetsInTemplate: true,
    templatePath: location.pathname.replace(/\/[^/]+$/, '') + dojo.moduleUrl("/templates", "StreamCreation.html"),
    basePath: dojo.moduleUrl("dijit"),
    
    constructor: function(params, srcNodeRef) {
      this.app = params.app;
      this.options = {
        "source" : "twitter",
        "keywords" : [],
        "limit" : 10000,
        "period" : {"start": null, "end": 10000},
        "alerts" : {},
        "style" : {"stroke": {}}
      };
      
      this.sourceAttributes = {
        "twitter" : ["followers", "following", "tweets", "attribute"],
        "foursquare" : [],
        "instagram" : [],
        "flickr" : []
      };
      
      this._times = {
        "10 seconds" : 10*1000,
        "1 minute" : 60*1000,
        "30 minutes" : 1800*60000,
        "1 hour" : 3600*1000,
        "unlimited" : "unlimited"
      };
    },
    
    startup: function() {
      this.activeStyler = 'fill';
      this.activeFill = 'rgb(5, 112, 176)';
      this.activeSize = 8;
      this.activeStrokeWidth = .5;
      this.activeStrokeColor = 'rgb(255, 255, 255)';  
      this.activeShape = 'STYLE_CIRCLE';  
      this.activeBreaks = 6;
      this.activeColors = [];
      this.activeClassificationType = "quantile";
      this.activeOpacity = 0.7;
      this.streamDuration = 10000;
        
      this.inherited(arguments);
      this.initDrawTool();
      this._buildAccordion();
      this._uiControls();
      this.updateStylePalette();
      this._setStyle();
      this.wire();
      
    },
    
    /*
	 * 
	 * Wire all the initial UI events
	 * 
	 */
    wire: function() {
      var self = this;
      
      // Set query keywords
      conn.connect(this.twitterKeywords, "keyup, blur", function(e) {
        self.keywordPills(e);
      });
      
      // advanced search
      conn.connect(this.advancedBtn, 'click', function(e) {
        self.customPeriod.style.display = 'block';
        self.advancedBtn.style.display = 'none';
      });
      
      conn.connect(this.closeCustomPeriod, 'click', function(e) {
        self.customPeriod.style.display = 'none';
        self.advancedBtn.style.display = 'block';
      });
      
      conn.connect(this.endTime, 'change', function(e) {
        self.streamDuration = self._times[e.target.value];
      });
      
      // Create - any
      query('.create').onclick(function(e) {
        // created time
        var start = new Date().getTime();
        self.options.period.start = start; 
        // end
        
        var end = start + self.streamDuration;
        self.options.period.end = end;
        
        // now start stream
        //self.createStream();
        self.createLayer(null);
        dojo.byId('newBtn').innerText = "编辑数据流";
      });
      
      // color palette
      query('.colorgrid a').onclick(function(e) {
        self.setColor(e);
      });
      
      // fill / stroke toggle
      query('.color-tab').onclick(function(e) {
        self.activeStyler = e.target.title;
        domClass.remove(query('.color-tab.active')[0], 'active');
        domClass.add(this, 'active');
        
        if (self.options.aggregate && self.activeStyler == 'stroke') {
          domClass.add(dom.byId('aggcolorgrid'), 'stroke');
        } else if (self.options.aggregate && self.activeStyler == 'fill') {
          domClass.remove(dom.byId('aggcolorgrid'), 'stroke');
        }
      });
      
      /*
		 * Styling binds
		 * 
		 */
      // set icon size
      on(this.iconPlus, "click", lang.hitch(this, function() {
        this.setSize('plus');
      }));
      on(this.iconMinus, "click", lang.hitch(this, function() {
        this.setSize('minus');
      }));
      
      
      // set icon stroke size
      on(this.iconStrokePlus, "click", lang.hitch(this, function() {
        this.setStroke('plus');
      }));
      on(this.iconStrokeMinus, "click", lang.hitch(this, function() {
        this.setStroke('minus');
      }));
      
      // set icon shape!
      on(this.iconSquare, "click", lang.hitch(this, function() {
        this.setShape('STYLE_SQUARE')
      }));
        
      on(this.iconCircle, "click", lang.hitch(this, function() {
        this.setShape('STYLE_CIRCLE')
      }));
      
      // set aggregation stroke size
      conn.connect(this.aggStrokeMinus, 'click', function(e) {
        self.setStroke('minus');
      });
      
      conn.connect(this.aggStrokePlus, 'click', function(e) {
        self.setStroke('plus');
      });
      
      // set classification type
      conn.connect(dom.byId('classification-type-select'), 'change', function(e) {
        self.activeClassificationType = e.target.value;
        self._setStyle();
      }); 
      
      // set breaks
      conn.connect(dom.byId('agg-breaks-select'), 'change', function(e) {
        self.activeBreaks = parseInt(e.target.value);
        self._redrawAggPreview();
        self._setStyle();
      }); 
      
      // alerts!
      conn.connect(this.addAlertRecepient, 'click', function(e) {
        self.addRecepient();
      }); 
      
      query('.alert-calc-item').onclick(function(e) {
        dom.byId('alert-current-calc').innerHTML = e.target.title;
        self.options.alerts.calculator = e.target.title;
      });
      
      query('.alert-attr-item').onclick(function(e) {
        dom.byId('alert-current-attr').innerHTML = e.target.title;
        self.options.alerts.calculator = e.target.title;
      });
      
      query('.alert-operator-item').onclick(function(e) {
        dom.byId('alert-current-opp').innerHTML = e.target.title;
        self.options.alerts.calculator = e.target.title;
      });
      
      conn.connect(dom.byId('alert-value'), 'keyup, change', function(){
        dom.byId('alert-current-value').innerHTML = this.value;
      });
      
      // end
    },
    
    
    /*
	 * 
	 * UI Controls Handles navigation through main creation UI steps
	 * 
	 */
    _uiControls: function() {
      query('.creation-step').onclick(function(e) {
        
        if (domClass.contains(this, 'creation-disabled')) return;
        
        domClass.remove(query('.step-selected')[0], 'step-selected');
        domClass.add(dom.byId(e.target.id), 'step-selected');
        
        arr.forEach(query('.creation-step-content'), function(d) {
          d.style.display = 'none';     
        });
         
        var tabs = {
          "creation-step-1" : "creation-new-stream",
          "creation-step-2" : "creation-analysis",
          "creation-step-3" : "creation-visualization",
          "creation-step-4" : "creation-alerts"
        }
        
        // show active tab
        var active = tabs[this.id];
        dom.byId(active).style.display = 'block';
        
        // css trickery for style preview
        if (active == 'creation-visualization') {
          domClass.add(dom.byId('creator'), 'bg_chopped');
        } else {
          domClass.remove(dom.byId('creator'), 'bg_chopped');
        }
      });
      
      
      // individual controls
      query('#creation-add-analysis').onclick(function(e) {
        dom.byId('creation-new-stream').style.display = 'none';
        dom.byId('creation-analysis').style.display = 'block';
        domClass.remove(query('.step-selected')[0], 'step-selected');
        domClass.add(dom.byId('creation-step-2'), 'step-selected');
      });
      
      query('#creation-add-viz').onclick(function(e) {
        dom.byId('creation-analysis').style.display = 'none';
        dom.byId('creation-visualization').style.display = 'block';
        domClass.remove(query('.step-selected')[0], 'step-selected');
        domClass.add(dom.byId('creation-step-3'), 'step-selected');
        domClass.add(dom.byId('creator'), 'bg_chopped');
      });
      
      query('#creation-review').onclick(function(e) {
        dom.byId('creation-visualization').style.display = 'none';
        dom.byId('creation-alerts').style.display = 'block';
        domClass.remove(query('.step-selected')[0], 'step-selected');
        domClass.add(dom.byId('creation-step-4'), 'step-selected');
      });
    },
    
    /*
	 * 
	 * Keyword Pills Creates pills for keyword search options on stream setup
	 * 
	 */
    keywordPills: function(e) {
      var self = this;
      var pill = e.target.value;
      this.options.keywords = [];
      
      // ADD pill, update options
      if (e.keyCode == 32 || e.keyCode == 13 || e.type == 'blur') {
        
        if (pill != "" && pill != " " && pill != "  ") {
          var html = '<span title="'+pill+'" class="keyword-selected">\
            <span> '+ pill +' </span>\
            <span title="'+pill+'" class="remove-keyword icon-remove-circle"></span>\
            </span>'
          dojo.create('li', {innerHTML: html}, 'keyword-input-li', 'before')
          
          dojo.byId('keyword-input').value = '';
        }
        
        dojo.query('.keyword-selected').forEach(function(f,i) {
          var title = f.title.replace(/(^\s+|\s+$)/g, '');
          if (title != "") self.options.keywords.push(title);
        });
        
      }
      
      // REMOVE pills on click
      query('.remove-keyword').onclick(function(e) {
        var val = e.target.title;
        dojo.destroy(e.target.parentNode);
        
        for (word in self.options.keywords) {
          if (val == self.options.keywords[word])  self.options.keywords.splice(word, 1);
        }
        
        dojo.query('.keyword-selected').forEach(function(f,i) {
          var title = f.title.replace(/(^\s+|\s+$)/g, '');
          self.options.keywords.push(title);
        });
      });
      
      // DELETE pill
      if (e.keyCode == 8) {
        if (dojo.byId('keyword-input').value == '') {
          var list = dojo.byId("keyword-list"),
            items = list.getElementsByTagName("li");
     
          if (items.length){
            dojo.destroy(items[items.length - 2]);
          }
        }
        
        dojo.query('.keyword-selected').forEach(function(f,i) {
          var title = f.title.replace(/(^\s+|\s+$)/g, '');
          self.options.keywords.push(title);
        });
      }
      
      if (self.options.keywords.length > 0) {
        dom.byId('keyword-help').style.display = "none";
      } else {
        dom.byId('keyword-help').style.display = "block";
      }
      
    },
    
    /*
	 * 
	 * Handles setting / removing aggregation options
	 * 
	 */
    setAggregation: function(e) {
      var val = (e.target.value) ? e.target.value : null;
      if (val) {
        if (!this.options.aggregate){
          this.options.aggregate = {};
          this.options.aggregate.empty_boundaries = true;
          this.options.aggregate.type = 'point';
        }
        this.options.aggregate.boundary = val;
        this.updateStylePalette();
        dom.byId('agg-options').style.display = "block";
        app.updateAggregator( this.options );
      } else {
        delete this.options.aggregate;
        dom.byId('agg-options').style.display = "none";
        this.updateStylePalette();
      }
    },
    
    /*
	 * 
	 * Drawing tool Init drawing tool used by geofence analysis option
	 * 
	 */
    initDrawTool: function() {
      var self = this;
      this.tb = new esri.toolbars.Draw(app.map);
      this.tb.fillSymbol.color = new dojo.Color( [75, 75 ,75, 0.1] );
      this.tb.fillSymbol.outline.color = new dojo.Color( [8, 69, 148, 0.7] );

      dojo.connect( this.tb, "onDrawEnd", function(d) { self.addGeofence(d) } );
    },

    
    /*
	 * Geofence controls (Add/Remove) graphics layer
	 * 
	 * 
	 */
    addGeofence: function(geometry) {
      var symbol = this.tb.fillSymbol;
      
      var graphic = new esri.Graphic(geometry, symbol);
      
      if (!this.graphics) {
        this.graphics = new esri.layers.GraphicsLayer();
        this.graphics.id = 'geofence';
        app.map.addLayer(this.graphics);
      }
      
      this.graphics.add(graphic.setSymbol(symbol));
      
      app.map.reorderLayer(graphic, 0);
      this.options.geofence = {"geometry" : graphic.geometry.rings[0]};
    },
        
    removeGeofence: function() {
      this.graphics = null;
      this.options.geofence = null;
      app.map.removeLayer( app.map._layers["geofence"] );
      domClass.remove('polygon-geofence', 'active');
      domClass.remove('circle-geofence', 'active');
    },
    
    /*
	 * 
	 * builds style palette, toggles visibility between agg/points
	 * 
	 */ 
    updateStylePalette: function() {
      var self = this;
      
      // single
      if (!this.options.aggregate) {
          
        if (this.preview) {
          dom.byId('style-single').style.display = "block";
          dom.byId('style-agg').style.display = "none";
          return;
        }
        
        var pointSlider = new dijit.form.HorizontalSlider({
          name: "point-opacity-slider",
          value: self.activeOpacity,
          minimum: 0,
          maximum: 1,
          intermediateChanges: true,
          style: "width:253px;",
          onChange: function(value){
            self.activeOpacity = value;
            dojo.attr(self.preview[0].getNode(), 'fill-opacity', self.activeOpacity);
            self._setStyle();
          }
        }, "point-opacity-slider");
        
        this.preview = [];
        this.previewSurface = dojox.gfx.createSurface("icon-example", 44, 50);
        this.preview.push(this.previewSurface.createCircle({ cx: 22, cy: 22, r: this.activeSize })
          .setFill(this.activeFill)
          .setStroke({width: this.activeStrokeWidth, color: this.activeStrokeColor}));
        
        dojo.attr(this.preview[0].getNode(), 'fill-opacity', this.activeOpacity);
        
        this.btnCircle = [];
        this.btnCircleSurface = dojox.gfx.createSurface("circlebtn", 13, 15);
        this.btnCircle.push(this.btnCircleSurface.createCircle({ cx: 7, cy: 9, r: 5 }).setStroke({width:2, color: "black"}));
        
        this.btnsquare = [];
        this.btnSquareSurface = dojox.gfx.createSurface("squarebtn", 12, 15);
        this.btnsquare.push(this.btnSquareSurface.createRect({ x: 1, y: 4, width:10, height:10 }).setStroke({width:2, color: "black"}));
        
        dom.byId('style-single').style.display = "block";
        var cnt = 0;
        for (color in colorbrewer) {
          cnt++;
          if (cnt >= 11) return;
          dojo.create('li', {id: 'li_'+cnt}, 'colorgrid');
          var row = colorbrewer[color][8];
          for (c in row) {
            dojo.create('a', {style: {'background':row[c]}}, 'li_'+cnt);  
          }
        };       
       
      } else {
        
        if (this.aggpreview) {
          dom.byId('style-single').style.display = "none";
          dom.byId('style-agg').style.display = "block";
          return;
        }
        
        var aggSlider = new dijit.form.HorizontalSlider({
          name: "slider",
          value: self.activeOpacity,
          minimum: 0,
          maximum: 1,
          intermediateChanges: true,
          style: "width:253px;",
          onChange: function(value){
            self.activeOpacity = value;
            for (i in self.aggpreview) {
              dojo.attr(self.aggpreview[i].getNode(), 'fill-opacity', self.activeOpacity);
            }
            self._setStyle();
          }
        }, "agg-opacity-slider");
        
        this.activeColors = colorbrewer["OrRd"][6];
        
        this.aggpreview = [];
        this.aggpreviewSurface = dojox.gfx.createSurface("agg-example", 200, 50);
        
        var x;
        if (this.activeBreaks == 6) x = 3;
        if (this.activeBreaks == 5) x = 20;
        if (this.activeBreaks == 4) x = 30; 
        if (this.activeBreaks == 3) x = 47;
        
        for (var i = 0; i<this.activeBreaks; i++) {
          this.aggpreview.push(this.aggpreviewSurface.createRect({ x: x, y: 10, width: 30, height:30 }).setFill(this.activeColors[i]).setStroke({width: this.activeStrokeWidth, color: this.activeStrokeColor}));
          dojo.attr(this.aggpreview[i].getNode(), 'fill-opacity', this.activeOpacity);
          x = x + 33;
        }
          
        dom.byId('style-single').style.display = "none";
        dom.byId('style-agg').style.display = "block";
        var cnt = 0;
        for (color in colorbrewer) {
          cnt++;
          if (cnt < 11) {
            var row = colorbrewer[color][7];
            dojo.create('li', {id: 'li_agg_'+cnt, class: "agg-colors", title: color}, 'aggcolorgrid');
            for (c in row) {
              dojo.create('span', {style: {'background':row[c]}}, 'li_agg_'+cnt);  
            }
          }
        };
          
        query('.aggcolorgrid li').onclick(function(e) {
          var active = query('.color-grid-active');
          if (active[0]) domClass.remove(active[0], 'color-grid-active');
          domClass.add(this, 'color-grid-active');
          if (!e.target.title) {
            var color = e.target.style.background.replace(/rgb/, '').replace(/\(/, '').replace(/\)/,''),
              red = parseInt(color.split(',')[0]),
              green = parseInt(color.split(',')[1]),
              blue = parseInt(color.split(',')[2]);
            var colors = [];
              colors.push(red, green, blue)
              self.setColor(e, colors)
          } else {
            var color = e.target.title;
            self.setColor(e, color)  
          }
           
        });
      }
      this._setStyle();
    }, 
    
    _redrawAggPreview: function() {
      this.aggpreviewSurface.clear();
      this.aggpreview = [];
      
      var x;
      if (this.activeBreaks == 6) x = 3;
      if (this.activeBreaks == 5) x = 20;
      if (this.activeBreaks == 4) x = 30; 
      if (this.activeBreaks == 3) x = 47;
      
      for (var i = 0; i<this.activeBreaks; i++) {
        this.aggpreview.push(this.aggpreviewSurface.createRect({ x: x, y: 10, width: 30, height:30 }).setFill(this.activeColors[i]).setStroke({width: this.activeStrokeWidth, color: this.activeStrokeColor}));
        dojo.attr(this.aggpreview[i].getNode(), 'fill-opacity', this.activeOpacity);
        x = x + 33;
      }
    },
    
    
    /*
	 * 
	 * SET Fill and Stroke colors for points and aggregation
	 * 
	 * 
	 */
    setColor: function(e, color) {
      var self = this;
      if (!this.options.aggregate) {
        var color = e.target.style.background.replace(/rgb/, '').replace(/\(/, '').replace(/\)/,''),
          red = parseInt(color.split(',')[0]),
          green = parseInt(color.split(',')[1]),
          blue = parseInt(color.split(',')[2]);
        
        if (this.activeStyler == 'fill') {
          this.activeFill =  e.target.style.background;
          arr.forEach(this.preview, function(f,i) {
            f.setFill([red, green, blue, self.activeOpacity])
          });
        } else {
          this.activeStrokeColor =  e.target.style.background;
          this.preview[0].setStroke({width: this.activeStrokeWidth, color: [red, green, blue]});
        }
      } else {
        if (color.length == 3) {
          for (obj in this.aggpreview) {
            this.aggpreview[obj].setStroke({width: this.activeStrokeWidth, color: [color[0], color[1], color[2]]});
          }
          this.activeStrokeColor =  e.target.style.background;
        } else {
          var colors = colorbrewer[color][this.activeBreaks];
          for (i in colors) {
            this.aggpreview[i].setFill(colors[i]);
            dojo.attr(this.aggpreview[i].getNode(), 'fill-opacity', this.activeOpacity);
          }
          this.activeColors = colors;
        }
      }
      this._setStyle();
    },
    
    /*
	 * 
	 * Set Icon Size
	 * 
	 */
    setSize: function(size) {
      if (size == "plus") { this.activeSize++ } else { this.activeSize-- };
      if (this.activeSize >= 18) this.activeSize = 18;
      if (this.activeSize <= 2) this.activeSize = 2;
      if (this.activeShape == 'STYLE_CIRCLE') {
        this.preview[0].setShape({"r" : this.activeSize});  
      } else {
        this.preview[0].setShape({ x: 28 - this.activeSize, y: 25 - this.activeSize, width : this.activeSize, height: this.activeSize});
      }
      this._setStyle();
    },
    
    /*
	 * 
	 * Set stroke SIZE for aggregation and points
	 * 
	 */
    setStroke: function(size) {
      var self = this;
      
      if (!this.options.aggregate) {
        if (size == "plus") { this.activeStrokeWidth++ } else { this.activeStrokeWidth-- };
        if (this.activeStrokeWidth >= 7) this.activeStrokeWidth = 7;
        if (this.activeStrokeWidth <= 0) this.activeStrokeWidth = 0;
        this.preview[0].setStroke({ width: this.activeStrokeWidth, color: this.activeStrokeColor });
      } else {
        if (size == "plus") { this.activeStrokeWidth++ } else { this.activeStrokeWidth-- };
        if (this.activeStrokeWidth >= 7) this.activeStrokeWidth = 7;
        if (this.activeStrokeWidth <= 0) this.activeStrokeWidth = 0;
        arr.forEach(this.aggpreview, function(f,i) {
          f.setStroke({ width: self.activeStrokeWidth, color: self.activeStrokeColor });
        });
      }
      this._setStyle();
    },
    
    /*
	 * 
	 * Change icon shape (circle/square supported)
	 * 
	 * 
	 */
    setShape: function(shape) {
      this.activeShape = shape;
      this.previewSurface.clear();
      this.preview = [];
      if (shape == 'STYLE_SQUARE') {
        this.preview.push(this.previewSurface.createRect({ x: 28 - this.activeSize, y: 25 - this.activeSize, width: this.activeSize, height: this.activeSize })
          .setFill(this.activeFill)
          .setStroke({width: this.activeStrokeWidth, color:this.activeStrokeColor}));
        dojo.attr(this.preview[0].getNode(), 'fill-opacity', this.activeOpacity);  
      } else {
        this.preview.push(this.previewSurface.createCircle({ cx: 22, cy: 22, r: this.activeSize })
          .setFill(this.activeFill)
          .setStroke({width: this.activeStrokeWidth, color:this.activeStrokeColor}));
        dojo.attr(this.preview[0].getNode(), 'fill-opacity', this.activeOpacity);
      }
      this._setStyle();
    },
    
    /*
	 * 
	 * Updates the style options
	 * 
	 */
    _setStyle: function() {
      if (!this.options.aggregate) {
        this.options.style.colors = null;
        this.options.style.classificationType = null;
        this.options.style.breaks = null;
        this.options.style.opacity = this.activeOpacity;
        this.options.style.stroke.width = this.activeStrokeWidth;
        this.options.style.stroke.color = this.activeStrokeColor;
        this.options.style.fill = this.activeFill;
        this.options.style.size = this.activeSize;
        this.options.style.shape = this.activeShape;
      } else {
        this.options.style.fill = null;
        this.options.style.shape = null;
        this.options.style.opacity = this.activeOpacity;
        this.options.style.breaks = this.activeBreaks;
        this.options.style.colors = this.activeColors;
        this.options.style.classificationType = this.activeClassificationType;
      }
      // console.log('style: ', this.options.style)
    },
    
    /*
	 * 
	 * Add ALERT recepient
	 * 
	 */
    addRecepient: function(e) {
      dojo.create('div', {innerHTML: '<div class="alert-rec-container"><input type="text" class="alert-recepient" placeholder="123-444-5555"><i class="alert-remove icon-remove-circle"></i></div>'}, 'alerts-recepients');
      
      query('.alert-remove').onclick(function(e) {
        dojo.destroy(e.target.parentNode)
      });
      
    },
    
    _buildAccordion: function() {
      var self = this;
      var opts;
      /*
      if (location.hash.toLowerCase() == '#newyork') {
        opts = '<option class="aggregation-boundary" name="agg" type="radio" value="">None</option>\
        <option class="aggregation-boundary" name="agg" type="radio" value="200 meter">200-meter Microgrid Cells</option>\
        <option class="aggregation-boundary" name="agg" type="radio" value="1 km grid cells">1-km Grid Cells</option>\
        //<option class="aggregation-boundary" name="agg" type="radio" value="1 km hex bins">1-km Hex Cells</option>\
        <option class="aggregation-boundary" name="agg" type="radio" value="US Counties">US Counties</option>\
        <option class="aggregation-boundary" name="agg" type="radio" value="US States">US States</option>';
      } else {
        opts = '<option class="aggregation-boundary" name="agg" type="radio" value="">None</option>\
        <option class="aggregation-boundary" name="agg" type="radio" value="US Counties">US Counties</option>\
        <option class="aggregation-boundary" name="agg" type="radio" value="US States">US States</option>';
      }*/
      
      opts = '<option class="aggregation-boundary" name="agg" type="radio" value="">无</option>\
          <option class="aggregation-boundary" name="agg" type="radio" value="1k meter">1000米格网</option>\
          <option class="aggregation-boundary" name="agg" type="radio" value="400 meter">400米微格网</option>\
    	  <option class="aggregation-boundary" name="agg" type="radio" value="1 km hex bins">1000米蜂窝网</option>';
      
      var aContainer = new AccordionContainer({}, "accordion");
        aContainer.addChild(new ContentPane({
            title: "&raquo; 聚合",
            content: '\
            <div id="aggregation-main">\
              <div class="agg-inner">\
                <span>选择聚合范围:</span>\
                <span id="boundary-list-container"></span>\
              </div>\
              <div id="agg-options">\
                <div class="agg-inner">\
                  <input id="fromAttribute" class="aggregation-type" name="type" type="checkbox" value="attribute"></input><span> 计算统计值</span>\
                  <select id="equation-types" style="display:none" class="statEquationTypes">\
                    <option value="count">计数</option>\
                    <option value="wlq">区域加权平均</option>\
                  </select>\
                  <span id="lq-image"></span>\
                  <span id="sigma-image"></span>\
                  <div id="attribute-container" class="statAttributeList" type="text">\
                    <span id="select-attr-placeholder">Select Attribute</span>\
                  </div>\
                  <span id="attribute-list" style="display:none">\
                    <ul id="attrList">\
                    </ul>\
                  </span>\
                </div>\
                <div class="agg-inner">\
                  <input id="keep-empty-boundaries" type="checkbox" checked="checked" data-dojo-attach-point="keepEmptyBoundaries"></input><span> 保留空区域</span>\
                </div>\
              </div>\
            </div>'
        
        }));
        aContainer.addChild(new ContentPane({
            title:"&raquo; 地理围栏",
            content:'\
              <div id="geofence-container">\
                <div data-toggle="buttons-radio">\
                  <div class="btn geofence-btn" id="polygon-geofence">多边形</div>\
                  <div class="btn geofence-btn" id="circle-geofence">圆形</div>\
                </div>\
                <span class="geofence-blurb">选择作为地理围栏的形状，然后再地图上绘制地理围栏的范围，双击结束绘制。 <span>\
                <span class="btn" id="geofence-clear">清除地理围栏<span>\
              </div>'
        }));
        aContainer.addChild(new ContentPane({
          title:'&raquo; 附近',
          content: '<div id="nearby-container">\
                <span id="boundary-list-container-nearby">选择用于分析的数据: <br /></span>\
                <div id="nearby-options">\
                  <span id="attributes-list-container-nearby">设置用作临近分析距离大小：</span>\
                  <span>\
                    <input id="nearby-proximity-value" type="text" placeholder="距离"></input>\
                    <select id="nearby-proximity-unit"><option>Meters</option><option>Feet</option><option>Miles</option></select>\
                  </span>\
                  <div id="type-of-aggregation-nearby">\
                    <span>聚合类型:<br /></span>\
                    <input class="nearby-agg-type" type="radio" name="type-agg" value="count" checked></input> 点的个数 <br />\
                    <input class="nearby-agg-type" type="radio" name="type-agg" value="stats"></input> 通过属性计算\
                  </div>\
                  <div id="attributes-nearby">\
                    <select id="nearby-attribute-list" disabled><option>None</option></select>\
                    <select id="nearby-calculation-list" disabled><option>Calculation</option></select>\
                  </div>\
                </div>\
                </div>'
        }));
        aContainer.addChild(new ContentPane({
            title:"&raquo; 标准化",
            content: '\
              <div id="normalize-container">\
                <span id="boundary-list-container-normal">选择用于聚合的边界: <br /></span>\
                <span id="attributes-list-container-normal">选择属性: </span>\
                <span id="normalize-by-list-container-normal">标准化依据: </span>\
              </div>'
        }));
        aContainer.startup();
      
      // Set Empty boundaries
      conn.connect(this.keepEmptyBoundaries, 'click', function(e) {
        var checked = dojo.hasAttr(this, 'checked');
        if (checked == true) {
          self.options.aggregate.empty_boundaries = false;
        } else {
          self.options.aggregate.empty_boundaries = true;
        }
      });
      
      dojo.create('select', {id: "boundary-list", innerHTML: opts}, 'boundary-list-container');
      
      // set aggregation
      conn.connect(dom.byId('boundary-list'), 'change', function(e) {
        self.setAggregation(e);
      });
      
      // Set Type of Aggregation
      conn.connect(dom.byId('fromAttribute'), 'click', function(e) {
        if (dojo.getAttr(this, 'checked') == true) {
          self.options.aggregate.type = 'count';
          self.options.aggregate.attributes = [];
          dom.byId('equation-types').style.display = 'block';
          dom.byId('sigma-image').style.display = 'block';
          // query('.statAttributeList')[0].style.display = 'block';
        } else {
          self.options.aggregate.type = 'point';
          self.options.aggregate.attributes = null;
          dom.byId('equation-types').style.display = 'none';
        }
      });
      
      conn.connect(query('.statEquationTypes')[0], 'change', function(e) {
        dom.byId('attribute-list').style.display = 'none';
        self.options.aggregate.type = e.target.value;
        if (self.options.aggregate.type == 'wlq') {
          dom.byId('lq-image').style.display = 'block';
          dom.byId('sigma-image').style.display = 'none';
        } else {
          dom.byId('lq-image').style.display = 'none';
          dom.byId('sigma-image').style.display = 'block';
        }
      });
      
      conn.connect(query('.statAttributeList')[0], 'focus, click', function(e) {
        dojo.destroy(dom.byId('select-attr-placeholder'))
        dom.byId('attribute-list').style.display = 'block';
      });
      
      conn.connect(query('.statAttributeList')[0], 'mouseout, blur', function(e) {
        clearTimeout(self.attrTimeout);
        self.attrTimeout = setTimeout(function() {
          dom.byId('attribute-list').style.display = 'none';  
        }, 2300);
      });
      
      conn.connect(dom.byId('attrList'), 'mouseover', function() {
        dom.byId('attribute-list').style.display = 'block';
      });
      
      conn.connect(dom.byId('attrList'), 'mouseover', function() {
        clearTimeout(self.attrTimeout);
        self.attrTimeout = setTimeout(function() {
          dom.byId('attribute-list').style.display = 'none';  
        }, 2300);
      });
      
      setTimeout(function() {
        query('#attribute-list li').onclick(function(e) {
          self.addAttr(e);
        });  
      },1000);
      
      /*
		 * Geofence
		 * 
		 */
      conn.connect(dom.byId('polygon-geofence'), 'click', function() {
        self.tb.activate(esri.toolbars.Draw.POLYGON);
      });
      
      conn.connect(dom.byId('circle-geofence'), 'click', function() {
        self.tb.activate(esri.toolbars.Draw.CIRCLE);
      });
      
      conn.connect(dom.byId('geofence-clear'), 'click', function() {
        self.removeGeofence();
        self.tb.deactivate();
      });
      
      /*
		 * Nearby
		 * 
		 * 
		 */
      
      dojo.create('select', {id: "boundary-list-nearby", innerHTML: opts}, 'boundary-list-container-nearby');
      
      conn.connect(dom.byId('boundary-list-nearby'), 'change', function(e) {
        if (!self.options.nearby) self.options.nearby = {};
        self.options.nearby[ "dataset" ] = e.target.value;
        
        self.options.nearby.distance = 10;
        self.options.nearby.unit = 'meter';
        self.options.nearby.type = 'count';
        
        // remove if boundary is null
        var val = (e.target.value) ? e.target.value : null;
        if (!val) {
          dom.byId('nearby-options').style.display = "none";
          delete self.options.nearby;
        } else {
          dom.byId('nearby-options').style.display = "block";
        }
      });
      
      conn.connect(dom.byId('nearby-proximity-value'), 'keyup', function(e) {
        self.options.nearby[ "distance" ] = e.target.value;
      });
      
      conn.connect(dom.byId('nearby-proximity-unit'), 'change', function(e) {
        self.options.nearby[ "unit" ] = e.target.value;
      });
      
      query('.nearby-agg-type').onclick(function(e) {
        self.options.nearby[ "type" ] = e.target.value;
        
        if (e.target.value == 'stats') {
          domAttr.remove('nearby-attribute-list', "disabled");
          domAttr.remove('nearby-calculation-list', "disabled");
        } else {
          domAttr.set('nearby-attribute-list', "disabled", true);
          domAttr.set('nearby-calculation-list', "disabled", true);
        }
      });
      
      /*
		 * Normalization
		 * 
		 * 
		 */
      var attr_opts = '<option type="radio" value="">None</option>\
        <option type="radio" value="Followers">Followers</option>\
        <option type="radio" value="Tweets">Tweets</option>'
        
      var norm_by_opts = '<option type="radio" value="">None</option>\
        <option type="radio" value="Population">Population</option>'
      
      dojo.create('select', {id: "boundary-list-normal", innerHTML: opts}, 'boundary-list-container-normal');
      dojo.create('select', {id: "attributes-list-normal", innerHTML: attr_opts}, 'attributes-list-container-normal');
      dojo.create('select', {id: "normalize-by-list-normal", innerHTML: norm_by_opts}, 'normalize-by-list-container-normal');
      
      conn.connect(dom.byId('boundary-list-normal'), 'change', function(e) {
        if (!self.options.normalize) self.options.normalize = {};
        self.options.normalize[ "boundary" ] = e.target.value;
        
        // remove if boundary is null
        var val = (e.target.value) ? e.target.value : null;
        if (!val) {
          delete self.options.normalize;
        }
      });
      
      conn.connect(dom.byId('attributes-list-normal'), 'change', function(e) {
        self.options.normalize[ "attribute" ] = e.target.value;
      });
      
      conn.connect(dom.byId('normalize-by-list-normal'), 'change', function(e) {
        self.options.normalize[ "normalize_by" ] = e.target.value;
      });
      
      
      
    },
    
    /** **** EVENTS ***** */
   
    /*
	 * emits event "create" and sends creation options
	 * 
	 * 
	 */
    createStream: function() {
        var self = this;
        var source = this.options.source;
        var name = this.options.service_name || 'tweets_' + (Math.round(Math.random()*1000000).toString(16));
        var desc = "Stream of keywords " + this.options.keywords + ", from " + new Date(this.options.period.start).toLocaleString() + " to "
          + new Date(this.options.period.end).toLocaleString();

        var params = {
            // serviceName: name,
            type: 'StreamServer',
            description: desc,
            geometryType: "esriGeometryPoint",
            // extent: { rings: [ [ ] ], spatialReference: { wkid: 4326 } },
            spatialReference: { wkid: 4326 },
            datastore: this.options.db,
            fields: [
                     {
                         "name": "geometry",
                         "type": "esriFieldTypeGeometry",
                         "alias": "geometry"
                       }, {
                         "name": "client_stream_id",
                         "type": "esriFieldTypeString",
                         "alias": "client_stream_id"
                       }, {
                         "name": "content",
                         "type": "esriFieldTypeString",
                         "alias": "content"
                       }, {
                         "name": "content_type",
                         "type": "esriFieldTypeString",
                         "alias": "content_type"
                       }, {
                         "name": "created_at",
                         "type": "esriFieldTypeString",
                         "alias": "created_at"
                       }, {
                         "name": "geocontext",
                         "type": "esriFieldTypeString",
                         "alias": "geocontext"
                       }, {
                         "name": "payload_content",
                         "type": "esriFieldTypeString",
                         "alias": "payload_content"
                       }, {
                         "name": "payload_created_at",
                         "type": "esriFieldTypeString",
                         "alias": "payload_created_at"
                       }, {
                         "name": "payload_followers",
                         "type": "esriFieldTypeInteger",
                         "alias": "payload_followers"
                       }, {
                         "name": "payload_friends",
                         "type": "esriFieldTypeInteger",
                         "alias": "payload_friends"
                       }, {
                         "name": "payload_id",
                         "type": "esriFieldTypeOID",
                         "alias": "payload_id"
                       }, {
                         "name": "payload_latitude",
                         "type": "esriFieldTypeDouble",
                         "alias": "payload_latitude"
                       }, {
                         "name": "payload_longitude",
                         "type": "esriFieldTypeDouble",
                         "alias": "payload_longitude"
                       }, {
                         "name": "payload_location_type",
                         "type": "esriFieldTypeString",
                         "alias": "payload_location_type"
                       }, {
                         "name": "payload_picture",
                         "type": "esriFieldTypeString",
                         "alias": "payload_picture"
                       }, {
                         "name": "payload_user_name",
                         "type": "esriFieldTypeString",
                         "alias": "payload_user_name"
                       }, {
                         "name": "posted_at",
                         "type": "esriFieldTypeDate",
                         "alias": "posted_at"
                       }
                     ],
            uniqueIdField: 'content',
            entityIdField: null,
            // timestampField: 'payload_created_at'
            timestampField: 'created_at',
            analyses: {}
        };

        new stream.StreamService( this.app.options.stream_service.host, params, function( data ) {
          console.log("Stream Service Created!--------------------------",(new Date()).toLocaleString());
          self.options.StreamService = data;

          var stream_data = {
            name: name,
            source: source,
            parameters: {"query": ( self.options.keywords.length ) ? self.options.keywords.join(',') : null},
            // filters: [],
            extent: null,
            /*
			 * analyses: [ { name: "geocode"}, { name: "aggregation", inputs: [ {
			 * name: "boundary", value: "States"}, { name: "aggregates", value: [ {
			 * op: "sum", attr: "sentiment" }, { op: "average", attr:
			 * "sentiment"} ] } ] } ],
			 */
            socketUrl : "ws://192.168.110.138:8182/ws",//data.service.webSocketUrl,
            limit: params.limit,
            timestart: -1, // self.options.period.start,
            timestop : self.options.period.end
          };

          if ( self.options.geofence ){
            if (!stream_data.analyses) {
              stream_data.analyses = [];
            }
            stream_data.analyses.push( { name: 'geofence', value: self.options.geofence } );
          }

          // console.log('JSON', JSON.stringify(stream_data))
          self.app.socialAPI.stream( 'create', stream_data, function( err, stream ){
            if ( err ){
              console.log('Error starting the stream', err);
            } else if ( stream ) {
              console.log("Stream Created!--------------------------",(new Date()).toLocaleString());
              self.emit('create', self.options);
              dojo.byId('creator').style.display = "none";
              dojo.removeClass('add-stream', 'active');
              dojo.removeClass('add-data', 'active');
              self.createLayer( stream );
            }
          });

        }, function( err ) {
          console.log('Error creating stream service', err);
        });


      },

      createLayer: function( stream ){
        // set hash
        /*if ( this.options.StreamService.service.datastore ) {
          this.app.setHash({ stream: stream.id });
        }*/

        // based on the analysis, or lack of, what type of layer to render;
         // self.emit('create', self.options);
          dojo.byId('creator').style.display = "none";
          dojo.removeClass('add-stream', 'active');
          dojo.removeClass('add-data', 'active');
        this.app.addStreamLayer( /*this.options.StreamService.service.name*/"stream_88888", this.options );
        console.log("Stream Layer Created!--------------------------",(new Date()).toLocaleString());
      }

    });
  
  return StreamCreation
});
