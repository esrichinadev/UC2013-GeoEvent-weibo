//Layers Palette Dijit
dojo.provide("modules.About");
dojo.require('dijit.layout.ContentPane');
dojo.require('dojo.fx');
dojo.require('dojo.Evented');
dojo.require("dijit._Widget");
dojo.require("dijit._Templated");


dojo.declare("modules.About", [dijit._Widget, dijit._Templated, dojo.Evented], {
  
  widgetsInTemplate: true,
  templatePath: dojo.moduleUrl("/templates", "About.html"),
  basePath: dojo.moduleUrl("dijit"),
  
  constructor: function(params, srcNodeRef) {
    
  },
  
  startup: function(layers, params) {
    this.inherited(arguments);
    this.layers = layers;
    this.params = params;
    this._updateAbout();
    this._wire();
  },
  
  _wire: function() {
    dojo.connect(dojo.byId('summary-close'), 'click', function() {
      dojo.byId('about-this-map').style.display = "none";
    });
  }, 
  
  _updateAbout: function() {
    dojo.empty('about-container');
    dojo.create('div', {id: 'summary-close', innerHTML: '<span class="icon-remove-circle"></span>'}, 'about-container');
    dojo.create('div', {id: 'summary-keywords', innerHTML: '<span class="summary-key">Keywords: </span>'+this.params.keywords}, 'about-container');
    //dojo.create('div', {id: 'summary-limit', innerHTML: '<span class="summary-key">Limit: </span>'+this.params.limit}, 'about-container');
    // TODO was erroring for CHELM!!!!
    // TODO don't piss of CHELM!!!
    //var url = '<a href="' + app.options.service.url + '/' + app.options.app.stream.svc_name + '">'+app.options.app.stream.svc_name+'</a>';
    //dojo.create('div', {id: 'summary-service', innerHTML: '<span class="summary-key">Service: </span>'+url}, 'about-container');
    
    //summary agg
    if (this.params.aggregate) {
      dojo.create('div', {id: 'summary-agg-yes', innerHTML: '<span class="summary-key">Aggregation: </span> Yes.'}, 'about-container');
      dojo.create('div', {id: 'summary-agg-by', innerHTML: '<span class="summary-key">Boundary: </span>'+ this.params.aggregate.boundary}, 'about-container');
      dojo.create('div', {id: 'summary-agg-type', innerHTML: '<span class="summary-key">Aggregation Type: </span>'+ this.params.aggregate.type}, 'about-container');
    } else {
      dojo.create('div', {id: 'summary-agg-no', innerHTML: '<span class="summary-key">Aggregation: </span> No.'}, 'about-container');
    }
    
    /*
    //summary geofence
    if (this.params.geofence.type) {
      dojo.create('div', {id: 'summary-geofence-yes', innerHTML: '<span class="summary-key">Geofence: </span> Yes.'}, 'about-container');
    } else {
      dojo.create('div', {id: 'summary-geofence-no', innerHTML: '<span class="summary-key">Geofence: </span> No.'}, 'about-container');
    }
    */
   
    //summary alert
    if (this.params.alerts.type) {
      dojo.create('div', {id: 'summary-alerts-yes', innerHTML: '<span class="summary-key">Alert set: </span> Yes.'}, 'about-container');
    } else {
      dojo.create('div', {id: 'summary-alerts-no', innerHTML: '<span class="summary-key">Alert set: </span> No.'}, 'about-container');
    }
    
    //summary style
    dojo.create('div', {id: 'summary-style', innerHTML: '<span class="about-edit btn" disabled >Edit Styles</span>'}, 'about-container');
    dojo.create('div', {id: 'summary-style', innerHTML: '<span class="about-edit btn" disabled style="margin-left:10px">Add Alert</span>'}, 'about-container');
    
  }
});
