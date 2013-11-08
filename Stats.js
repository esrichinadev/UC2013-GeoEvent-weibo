//Stats Dijit
dojo.provide("modules.Stats");
dojo.require('dijit.layout.ContentPane');
dojo.require('dojo.fx');
dojo.require('dojo.Evented');
dojo.require("dijit._Widget");
dojo.require("dijit._Templated");


dojo.declare("modules.Stats", [dijit._Widget, dijit._Templated, dojo.Evented], {

  widgetsInTemplate: true,
  templatePath: dojo.moduleUrl("/templates", "Stats.html"),
  basePath: dojo.moduleUrl("dijit"),
  
  constructor: function(params, srcNodeRef) {
  },
  
  startup: function(layers, params, color) {
    dojo.byId('stats-div').style.display = "block";
    this.inherited(arguments);
    this.layers = layers;
    this.params = params;
    this.activeColor = color;
    this.total_messages = 0;
    this._build();
    this._setStyles(params);
    this._wire();
  },
  
  _wire: function() {
    var self = this;
    for (var i=0, li=this.layers.length; i<li;i++) {
      self.total_messages = self.total_messages + self.layers[i].graphics.length;
      dojo.connect(this.layers[i], 'onMessage', function() {
        self.total_messages++;
        dojo.byId('stat-total-messages').innerHTML = self._addCommas(self.total_messages);
        dojo.byId('stat-geo-messages').innerHTML = self._addCommas(this.stats.geolocated);
      });
    }
  },
  
  _build: function() {
    var self = this;
    
    //total messages
    var html = '<div class="stats-box-inner">\
      <span id="stat-total-messages" class="stat-nbr">1,000</span>\
      <span class="stat-title">Total Messages</span>\
      </div>';
    dojo.create('div', {id: "total-messages", class: 'stat-box', innerHTML: html}, 'stats-box-container');
    
    //geolocated tweets
    var html = '<div class="stats-box-inner">\
      <span id="stat-geo-messages" class="stat-nbr"></span>\
      <span class="stat-title">Geolocated Messages</span>\
      </div>';
    dojo.create('div', {id: "geo-messages", class: 'stat-box', innerHTML: html}, 'stats-box-container');
  },
  
  _setStyles: function(params) {
    if (!this.activeColor) this.activeColor = this.layers[0].renderer.symbol.color;
    dojo.query('.stat-nbr').style("color", this.activeColor);
  },
  
  _addCommas: function(nStr) {
    nStr += '';
    x = nStr.split('.');
    x1 = x[0];
    x2 = x.length > 1 ? '.' + x[1] : '';
    var rgx = /(\d+)(\d{3})/;
    while (rgx.test(x1)) {
      x1 = x1.replace(rgx, '$1' + ',' + '$2');
    }
    return x1 + x2;
  }
 
});