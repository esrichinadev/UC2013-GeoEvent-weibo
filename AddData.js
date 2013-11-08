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
  "dojo/request",
  "dojo/json",
  "dojo/on"
],

function(declare, lang, conn, arr, query, dom, html, domClass, domConstruct, domStyle, 
    domGeometry, require, gfx, fx, gfxShape, WidgetBase, TemplatedMixin, Slider, AccordionContainer, ContentPane, Evented, on, request, json, on) {
  var AddData = declare("modules.AddData", [WidgetBase, TemplatedMixin], {
    widgetsInTemplate: true,
    templatePath: location.pathname.replace(/\/[^/]+$/, '') + dojo.moduleUrl("/templates", "AddData.html"),
    basePath: dojo.moduleUrl("dijit"),
    
    constructor: function(params, srcNodeRef) {
      this._existingLayers = []; //tracks which layers have been added to map
    },
    
    startup: function() {
      this._wire();
    },
    
    _wire: function( ) {
      var self = this;
      
      //select layer to add to map
      on(dom.byId('add-data-results'), 'click', function(e) {
        var url = e.target.id;
        
        if (domClass.contains(url, 'layer-added')) {
          domClass.remove(url, 'layer-added')
          self._removeLayer( url );
        } else {
          domClass.add(url, 'layer-added')
          self._addLayer( url );
        }
                 
      });
      
      on(dom.byId('add-data-by-tags'), 'change', function( e ) {
        self._searchByTags( e );
      });
      
      //Keyword Search
      on(dom.byId('add-data-search'), 'keyup', function(e) {
        self._searchAGOL( e );
      });
                   
    },
    
    
    /*
     * Search ArcGIS by keyword 
     * 
     */
    _searchAGOL: function ( e ) {
      var val = e.target.value,
          guid,
          url = "http://www.arcgis.com/sharing/rest/search?f=json&q=title:"+val+" type:%22feature+service%22"
        
      if (val != '') {
        dom.byId('add-data-loading').style.display = "block";
        dom.byId('add-data-list-container').style.display = "none";
        domConstruct.empty('add-data-results');
        
        var requestHandle = esri.request({
          url: url,
          content: url,
          callbackParamName: "jsoncallback",
          load: function(data) {
            dom.byId('add-data-loading').style.display = "none";
            var layers = [];
            
            arr.forEach(data.results, function(res,i) {
              layers.push(res);
              dojo.create('li', { innerHTML: res.title, id: res.url, class: 'result-item' }, 'add-data-results');
              arr.forEach(self._existingLayers, function(lyr, i) {
                if (lyr == res.url) {
                  //is added
                  domClass.add( res.url, 'layer-added' )
                  var id = res.url + '-loading';
                  dojo.create( 'div', { id: id, class: "add-layer-added" }, res.url );
                }
              });
            });
            
            if (layers.length == 0) {
              dom.byId('add-data-list-container').innerHTML = "No results found";
              dom.byId('add-data-list-container').style.display = "block";      
            } else {
              dom.byId('add-data-list-container').style.display = "none";
            }
            
          }
        });
      }
    },
    
    /*
     * 
     * Search by Tags
     * 
     */
    _searchByTags: function ( e ) {
      var val = e.target.value,
          guid,
          url = "http://www.arcgis.com/sharing/rest/search?f=json&q=tags:"+val+" type:%22feature+service%22"
       
      if (val != '') {
        dom.byId('add-data-loading').style.display = "block";
        dom.byId('add-data-list-container').style.display = "none";
        domConstruct.empty('add-data-results');
        
        var requestHandle = esri.request({
          url: url,
          content: url,
          callbackParamName: "jsoncallback",
          load: function(data) {
            dom.byId('add-data-loading').style.display = "none";
            var layers = [];
            
            arr.forEach(data.results, function(res,i) {
              layers.push(res);
              dojo.create('li', { innerHTML: res.title, id: res.url, class: 'result-item' }, 'add-data-results');
              arr.forEach(self._existingLayers, function(lyr, i) {
                if (lyr == res.url) {
                  //is added
                  domClass.add( res.url, 'layer-added' )
                  var id = res.url + '-loading';
                  dojo.create( 'div', { id: id, class: "add-layer-added" }, res.url );
                }
              });
            });
            
          }
        });
      }

    },
    
    /*
     * Add layer to map 
     * Updates active layers
     * 
     */
    _addLayer: function( url ) {
      
      this._existingLayers.push( url );
      
      //loader
      var id = url + '-loading';
      dojo.create( 'div', { id: id, class: "add-layer-loading" }, url );
      
      url = url + "/0";
      var layer = new esri.layers.FeatureLayer(url, {
        "mode": esri.layers.FeatureLayer.MODE_SNAPSHOT,
        "id" : url,
        "outFields": ["*"]
      });
      
      app.map.addLayer(layer);
      
      conn.connect(layer, 'onLoad', function() {
        domClass.remove(id, 'add-layer-loading');
        domClass.add(id, 'add-layer-added');
      });
    },
    
    /*
     * 
     * Remove Layer
     * 
     */
    _removeLayer: function( url ) {
      var self = this;
      
      arr.forEach(self._existingLayers, function(lyr, i) {
        if (lyr == url) {
          self._existingLayers.splice(i,1);
        }
      });
      
      domConstruct.destroy(url + '-loading')
      app.map.removeLayer( app.map._layers[ url + "/0" ] );
    }
    
  
  });
  return AddData;
});