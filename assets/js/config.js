define('assets/js/config.js-*loadInit',{
	names:["dojo","dijit","dojox"],
	def:function(dojo,dijit,dojox){}});

define(["dojo","dijit","dojox","dojo/loadInit!assets/js/config.js-*loadInit"], function(dojo,dijit,dojox){
var config =  {
  stream_service: {
    host: 'http://socialdev.dc.esri.com/admin/services'
  },
  social_stream: {
    host: 'http://socialdev.dc.esri.com/anvil', 
  },
  socket_service:"ws://124.205.245.99:6180/ws",
  sina_timefield:"created_at",
  sina_idfield:"id",
  boundaries: {
	'400 meter': {
		url: 'data/bj_grid_400m.json', 
		key: 'FID', 
		zoomToExtent: true, 
		geojson:true
		},
    '1k meter': {
    	url: 'data/bj_grid_1km.json', 
    	key: 'FID', 
    	zoomToExtent: true, 
    	geojson: true
    	},
	    '1 km hex bins': {
	    	url: 'data/bj_med_hex.json', 
	    	key: 'OBJECTID', 
	    	zoomToExtent: true, 
	    	geojson: true
	    	}
  }
};
return config;
});