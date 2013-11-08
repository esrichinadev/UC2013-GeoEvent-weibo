//Layers Palette Dijit
dojo.provide("modules.LayersPalette");
dojo.require('dijit.layout.ContentPane');
dojo.require('dojo.fx');
dojo.require('dojo.Evented');
dojo.require("dijit._Widget");
dojo.require("dijit._Templated");


dojo.declare("modules.LayersPalette", [dijit._Widget, dijit._Templated, dojo.Evented], {

  widgetsInTemplate: true,
  templatePath: dojo.moduleUrl("/templates", "LayersPalette.html"),
  basePath: dojo.moduleUrl("dijit"),
  
  constructor: function(params, srcNodeRef) {
    
  },
  
  startup: function(layers, params) {
    this.inherited(arguments);
    this.layers = layers;
    this.params = params;
    this.build();
    //this._bindEvents();
    this.wire();
  },
  
  wire: function() {
    var self = this;
    for (var i=0, li=this.layers.length; i<li;i++) {
      dojo.connect(this.layers[i], 'onMessage', function() {
        if (app.stream.Aggregator) self._updateBreaks(this);
      });
    }
  },
  
  build: function() {
    var self = this;
    dojo.empty(dojo.byId('layer-box-container'));
    
    dojo.forEach(this.layers, function(layer, i) {
      //console.log('LAYER', layer)
      var html = '<div class="layers-box-inner">\
        <span class="layer-title">'+layer.id+'</span>\
        <span class="layer-keywords">('+self.params.keywords+')</span>\
        <span id="legend_'+layer.id+'" class="layer-legend"></span>\
        <span id="legend_annotation_'+layer.id+'" class="layer-legend"></span>\
        <span class="layer-source">Data Source: Twitter</span>\
        </div>';
            //<span id="count_'+layer.id+'">'+layer.graphics.length+'</span>';
      dojo.create('div', {id: layer.id, class: 'layers-box', innerHTML: html}, 'layer-box-container');
      self.createLegend(layer);
    });
  },
  
  createLegend: function(layer) {
    
    if (this.params.style.colors) {
      this.aggLegend = [];
      this.aggLegendSurface = dojox.gfx.createSurface("legend_"+layer.id, 200, 50);
      this.aggAnnotationSurface = dojox.gfx.createSurface("legend_annotation_"+layer.id, 200, 50);
      
      var x;
      if (this.params.style.breaks == 6) x = 3;
      if (this.params.style.breaks == 5) x = 20;
      if (this.params.style.breaks == 4) x = 30; 
      if (this.params.style.breaks == 3) x = 47;
      
      for (var i = 0; i<this.params.style.breaks; i++) {
        this.aggLegend.push(this.aggLegendSurface.createRect({ x: x, y: 2, width: 30, height:30 }).setFill(this.params.style.colors[i])
          .setStroke({width: this.params.style.stroke.width, color: this.params.style.stroke.color}));
        x = x + 33;
      }  
    } else {
      if (this.params.style.shape == 'STYLE_CIRCLE') {
        this.preview = [];
        this.previewSurface = dojox.gfx.createSurface("legend_"+layer.id, 44, 50);
        this.preview.push(this.previewSurface.createCircle({ cx: 12, cy: 22, r: this.params.style.size })
          .setFill(this.params.style.fill)
          .setStroke({width: this.params.style.stroke.width, color: this.params.style.stroke.color}));  
      } else {
        this.preview = [];
        this.previewSurface = dojox.gfx.createSurface("legend_"+layer.id, 44, 50);
        this.preview.push(this.previewSurface.createRect({ x: 10, y: 10, width: this.params.style.size, height: this.params.style.size })
          .setFill(this.params.style.fill)
          .setStroke({width: this.params.style.stroke.width, color: this.params.style.stroke.color})); 
      }
      dojo.byId('legend_'+layer.id).style.right = '77px';
    }
  },
  
  _updateBreaks: function() {
    var breaks = this._getBreaks();
    
    var x = 0;
    if (this.params.style.breaks == 6) x = 33;
    if (this.params.style.breaks == 5) x = 53;
    if (this.params.style.breaks == 4) x = 63; 
    if (this.params.style.breaks == 3) x = 80;
    
    if (this.aggAnnotationSurface) { 
      this.aggAnnotationSurface.clear();
      this.aggAnnotationSurface.createLine({ x1:x - 33, y1: 2, x2:x - 33, y2:38 }).setStroke('#999');
      this.aggAnnotationSurface.createText({ x: x - 38, y: 49, text: breaks[1]} ).setFont( { size : "12px"} ).setFill('#444');
      for (i=0;i<breaks[0].length;i++){
        this.aggAnnotationSurface.createLine({ x1:x - 2, y1: 2, x2:x - 2, y2:38 }).setStroke('#999');
        this.aggAnnotationSurface.createText({ x: x - 7, y: 49, text: breaks[0][i]} ).setFont( { size : "12px"} ).setFill('#444');
        x = x + 33;
      }
      this.aggAnnotationSurface.createLine({ x1:x - 2, y1: 2, x2:x - 2, y2:38 }).setStroke('#999');
      this.aggAnnotationSurface.createText({ x: x - 7, y: 49, text: breaks[2]} ).setFont( { size : "12px"} ).setFill('#444');
    }
    
  },
  
  _getBreaks: function() {
    var min = app.stream.Aggregator.scale.domain()[0];
    var max = app.stream.Aggregator.scale.domain()[1];
    var classes = app.stream.Aggregator.breaks;

    var breaks = [],
      range = max - min;

    //for (var i=1; i < classes; i++) {
    //  breaks.push(Math.floor(min + i * range / classes))
    //}
    
    return [breaks, min, max];
  }
  /*_bindEvents: function() {
    var self = this;
    var layers = this.layers;
    
    console.log('bind', layers)
    for (var i=0, li=layers.length; i<li;i++) {
      var type = layers[i].declaredClass.match(/StreamLayer/g);
      if (type) {
        layers[i].on('message', function() {
          var val = parseFloat(dojo.byId("count_"+this.id).innerHTML) + 1;
          dojo.byId("count_"+this.id).innerHTML = val;
        });
      }
    }
  },*/
  
 
});