dojo.provide("modules.ClusterLayer");

dojo.addOnLoad(function() {

	dojo.declare("modules.ClusterLayer", null, {

		constructor : function(data, options) {
			//console.log(options);
			this.options = options || {};
			this.data = data;
			this.size = options.size || 8;
			this.pxgrid = this.options.pixelsSquare || 128;
			this.intervals = this.options.intervals || 5;
			this.rgb = this.options.rgb || [0, 151, 240];
			this.textrgb = this.options.textrgb || [5, 5, 5, 1.0];
			this.pattern = [];
			this.gravity = true;
			//sathya
			this.test = [];
			
			if(this.options.hasOwnProperty("gravity")) {
				this.gravity = this.options.gravity;
			}

			//this._getColors(this.pattern);
			//this._getColors();

			this._map = this.options.map;
			var id = this.options.id || ("ClusterGraphicsLayer" + Math.ceil(Math.random(100) * 100))
			this.graphics = new esri.layers.GraphicsLayer({
				id : id
			});
			if(this.options.hasOwnProperty("visible")) {
				this.graphics.visible = this.options.visible;
			}
			
			if(this._map.loaded) {
				this._map.addLayer(this.graphics);
			} else {
				dojo.connect(this._map, "onLoad", dojo.hitch(this, function() {
					this._map.addLayer(this.graphics);
				}));
			}
			this.globalMax = true;
			if(this.options.hasOwnProperty("globalMax")) {
				this.globalMax = this.options.globalMax;
			}
			dojo.connect(this._map, "onZoomEnd", this, this.regrid);
			this._draw();
			this.loaded = true;
			this.onLoad(this);
		},
		/*****************
		 * Public Methods
		 *****************/
		setOpacity : function(o) {
			if(this.opacity != o) {
				this.onOpacityChange(this.opacity = o);
			}
		},
		regrid : function() {
		  if (this.lastDataset) this.setData(this.lastDataset);
		},
		onLoad : function() {

		},
		onUpdateStart : function() {
		},
		onUpdateEnd : function() {
		},
		setData : function(dataPoints) {
		  this.onUpdateStart();
			this.lastDataset = dataPoints;
			this.count = dataPoints.length;
			var clusteredData = {};
			var gridSquaresWide = (dojo.coords(this._map.id).w * 1) / (this.pxgrid * 1);
			var gridSquareDivisor = (this._map.extent.xmax - this._map.extent.xmin) / gridSquaresWide;
			clusteredData["gridsquare"] = gridSquareDivisor;

			var minCount = 999999;
			var maxCount = 0;

			dojo.forEach(dataPoints, function(geoPoint) {
			  var geoKey = Math.round(geoPoint.y / gridSquareDivisor) + "|" + Math.round(geoPoint.x / gridSquareDivisor);
				if(clusteredData[geoKey]) {
				  clusteredData[geoKey].count += 1;
					clusteredData[geoKey].avgx += ((geoPoint.x - clusteredData[geoKey].avgx) / clusteredData[geoKey].count)
					clusteredData[geoKey].avgy += ((geoPoint.y - clusteredData[geoKey].avgy) / clusteredData[geoKey].count)
				} else {
				  clusteredData[geoKey] = {
						count : 1,
						avgx : geoPoint.x,
						avgy : geoPoint.y
					}
				}

				if(clusteredData[geoKey].count < minCount) {
					minCount = clusteredData[geoKey].count;
				}
				if(clusteredData[geoKey].count > maxCount) {
					maxCount = clusteredData[geoKey].count;
				}
			});

			this.data = {
				data : clusteredData,
				noDataValue : [0],
				minCluster : minCount,
				maxCluster : maxCount,
				points : dataPoints.length
			};
			clusteredData = {};

			//adjust the cluster pattern min/max values
			//equal interval breaks
			this.pattern = [];

			//var min = 1;
			//var max = dataPoints.length;

			var min = minCount;
			var max = maxCount;

			//var breaks = dataPoints.length / this.intervals;
			var breaks = Math.round((max - min) / this.intervals);			
			
			if(min == 1 || this.showSingle) {
				//this.intervals += 1;				
				this.pattern[0] = {
					min : 0,
					max : 1
				}
			}

			for(var i = 0; i <= this.intervals; i++) {				
				this.pattern[i+1] = {};
				this.pattern[i+1].min = min + (i * breaks);
				this.pattern[i+1].max = min + ((i + 1) * breaks);				
			}

			/*
			this.pattern[0] = {
			min : 0,
			max : 1
			};
			for(var i = 0; i < this.intervals; i++) {
			this.pattern[i + 1] = {};
			this.pattern[i + 1].min = min + (i * breaks);
			this.pattern[i + 1].max = min + ((i + 1) * breaks)
			}
			*/

			//console.log(this._getEqualInterval(dataPoints, this.intervals));
			//console.log(this.pattern);

			this._getColors();
			this._draw();
		},
		_getMax : function(array) {
			return Math.max.apply(Math, array);
		},
		_getMin : function(array) {
			return Math.min.apply(Math, array);
		},
		_getEqualInterval : function(points, intervals) {
			var breaks = points.length / intervals;
			var min = 1;
			var max = points.length;
			var classes = [];
			var start = 0;
			for(var i = start; i < intervals; i++) {
				classes[i] = {};
				classes[i].min = min + (i * breaks);
				classes[i].max = min + Math.floor(((i + 1) * breaks))
			}

			return classes;
		},
		clear : function() {
			// clear layer
			this.graphics.clear();
			this.test = [];
			console.log("Clear from cluster-----------------",new Date());
		},
		getColorValues : function() {
			var colors = [];
			var alpha = 0.25;
			dojo.forEach(this.pattern, function(cv) {
				//colors.push('rgba(' + cv.rgb.concat(alpha).join(",") + ')' );
				colors.push('rgba(' + this.rgb.concat(alpha).join(",") + ')');
				alpha += 0.15
			});
			return colors;
		},
		getRange : function() {
			var data = this.data;
			if(!data) {
				return;
			}

			var dataArray = data.data, noDataValue = data.noDataValue[0];
			var maxValue = 0;
			var minValue = 0;
			var map = this._map;
			for(var key in dataArray) {
				if(dataArray.hasOwnProperty(key)) {
					var val = dataArray[key];
					if(val == noDataValue) {
						continue;
					}
					if(!this.globalMax) {
						var onMapPix;
						if(key.split("|").length == 4) {
							onMapPix = map.toScreen(esri.geometry.Point(((key.split("|")[0] * 1 + key.split("|")[1] * 1) * dataArray["gridsquare"] / 2), ((key.split("|")[2] * 1 + key.split("|")[3] * 1) * dataArray["gridsquare"] / 2), map.spatialReference));
						} else if(key.split("|").length == 2) {
							try {
								onMapPix = map.toScreen(esri.geometry.Point(key.split("|")[1] * dataArray["gridsquare"] / 2, key.split("|")[0] * dataArray["gridsquare"] / 2), map.spatialReference);
							} catch(e) {
								// screen point could not be calculated - ignore this point
								continue;
							}
						}
						if(!onMapPix) {
							continue;
						}
					}
					if(val > maxValue) {
						maxValue = val;
					}
					if(val < minValue) {
						minValue = val;
					}
				}
			}
			return {
				min : minValue,
				max : maxValue
			};
		},
		setVisibility : function(val) {
			this.graphics.setVisibility(val);
		},
		show : function() {
			this.graphics.show();
		},
		hide : function() {
			this.graphics.hide();
		},

		/*******************
		 * Internal Methods
		 *******************/
		_draw : function() {
      var self = this;
			this.clear();
			if(!this.data) {
				return;
			}

			var data = this.data, noDataValue = data.noDataValue[0], dataArray = data.data;

			// Statistics
			var range = this.getRange();
			var minValue = range.min, maxValue = range.max;
			//console.log("Range: " + minValue + " to " + maxValue);
			if((minValue == maxValue) && (maxValue == 0)) {
				return;
			}

			var map = this._map;

			// Draw
			for(var key in dataArray) {
				if(dataArray.hasOwnProperty(key)) {
					if(key.indexOf("|") == -1) {
						continue;
					}

					var gridExtent = new esri.geometry.Extent({
						"xmin" : dataArray["gridsquare"] * key.split("|")[1] - dataArray["gridsquare"] / 2,
						"ymin" : dataArray["gridsquare"] * key.split("|")[0] - dataArray["gridsquare"] / 2,
						"xmax" : dataArray["gridsquare"] * key.split("|")[1] + dataArray["gridsquare"] / 2,
						"ymax" : dataArray["gridsquare"] * key.split("|")[0] + dataArray["gridsquare"] / 2,
						"spatialReference" : map.spatialReference
					});

					var pointCount = dataArray[key].count;
					var sym = null;
					var textsize = "9pt"; 
					var showText = true;
					
					for(var i = 0; i < this.pattern.length; i++) {
						showText = true;	
						if(pointCount <= this.pattern[i].max) {
							sym = this.pattern[i].symbol;
							textsize = this.pattern[i].textsize;
							if(this.pattern[i].max === 0)
								showText = false;
							break;
						} else {
						  sym = this.pattern[i].symbol;
            }
					}

					var centerLNG = dataArray["gridsquare"] * key.split("|")[1];
					var centerLAT = dataArray["gridsquare"] * key.split("|")[0];
					/*
					console.log("********");
						console.log("gridsquare : " , dataArray["gridsquare"] );
						console.log("center-lat: ", centerLAT, " center-lon: ", centerLNG);						
						//console.log("gridsquare/2 :", dataArray["gridsquare"]/2)
						console.log("dataArray[key].avgx = ", dataArray[key].avgx);
						console.log("dataArray[key].avgy = ", dataArray[key].avgy);
						//console.log("(centerLNG + dataArray[gridsquare] / 2) : ", (centerLNG + dataArray["gridsquare"] / 2))
						//console.log("Compare : " + 14 / this.pxgrid * dataArray["gridsquare"])
						console.log("point count ", pointCount);
						console.log("size: ", sym.size, sym.size*dataArray["gridsquare"]/2);
					console.log("********");
					*/
					if(this.gravity) {						
						var fourteen = this.size;
						//if (sym) {var fifty = sym.size} else {var fifty = 40};
						var fifty = sym.size;
						var compare = fourteen / this.pxgrid * dataArray["gridsquare"];
						var shiftby = dataArray["gridsquare"] * fifty / this.pxgrid;
						//var fifty = parseInt(this.pixgrid / 3);
						//console.log("********");
						//console.log("center-lat: ", centerLAT, " center-lon: ", centerLNG);	
						//console.log("Shift by: " ,shiftby);
						
						
						//var ptbefore = new esri.geometry.Point(dataArray[key].avgx,dataArray[key].avgy,map.spatialReference);
						//var ptcenter = new esri.geometry.Point(centerLNG,centerLAT,map.spatialReference);
						
						//var sms1 = new esri.symbol.SimpleMarkerSymbol().setStyle(esri.symbol.SimpleMarkerSymbol.STYLE_SQUARE).setColor(new dojo.Color([255,0,0,0.5]));
						//this.test.push(new esri.Graphic(ptbefore,sms1));
						//var sms2 = new esri.symbol.SimpleMarkerSymbol().setColor(new dojo.Color([0,255,0,0.5]));						
						//this.test.push(new esri.Graphic(ptcenter,sms2));						
						if((centerLNG + dataArray["gridsquare"] / 2) - dataArray[key].avgx <= compare) {
							//console.log("case lon + ", dataArray[key].count);
							//console.log(dataArray[key].avgx , " => ", centerLNG + shiftby);
							dataArray[key].avgx = centerLNG + shiftby
						}
						if(dataArray[key].avgx - (centerLNG - dataArray["gridsquare"] / 2) <= compare) {
							//console.log("case1 lon -", dataArray[key].count);
							//console.log(dataArray[key].avgx , " => ", centerLNG - shiftby);
							dataArray[key].avgx = centerLNG - shiftby
						}
						if((centerLAT + dataArray["gridsquare"] / 2) - dataArray[key].avgy <= compare) {
							//console.log("case lat +", dataArray[key].count);
							//console.log(dataArray[key].avgy , " => ", centerLAT + shiftby);
							dataArray[key].avgy = centerLAT + shiftby
						}
						if(dataArray[key].avgy - (centerLAT - dataArray["gridsquare"] / 2) <= compare) {
							//console.log("case lat -", dataArray[key].count);
							//console.log(dataArray[key].avgy , " => ", centerLAT - shiftby);
							dataArray[key].avgy = centerLAT - shiftby
						}
						//var ptnew = new esri.geometry.Point(dataArray[key].avgx,dataArray[key].avgy,map.spatialReference);
						//var sms3 = new esri.symbol.SimpleMarkerSymbol().setColor(new dojo.Color([0,0,255]));						
						//this.test.push(new esri.Graphic(ptnew,sms3));	
						
					} else {
						dataArray[key].avgx = centerLNG;
						dataArray[key].avgy = centerLAT;
					}
					
					//console.log("dataArray[key].avgx, dataArray[key].avgy, map.spatialReference", dataArray[key].avgx, dataArray[key].avgy, map.spatialReference)
					var onMapPix = new esri.geometry.Point(dataArray[key].avgx, dataArray[key].avgy, map.spatialReference);		
					
					//console.log('onMapPix', onMapPix, 'this,graphics', this.graphics)
          //console.log('onmappix', onMapPix, 'sym', sym, 'gridextent', gridExtent, 'poinrtoucnt', pointCount)
          /*
          dojo.forEach(gs.graphics, function(graphic) {
            console.log('this', gs)
            self.graphics.remove(graphic)
          });*/
          this.graphics.add(new esri.Graphic(onMapPix, sym, {
						extent : gridExtent,
						count : pointCount
					}));

					if(showText) {
						this.graphics.add(
						//new esri.Graphic(onMapPix, new
						// esri.symbol.TextSymbol(""+pointCount).setOffset(0, -5).setColor(new
						// dojo.Color(this.textrgb)),
						new esri.Graphic(onMapPix, new esri.symbol.TextSymbol(pointCount).setColor(new dojo.Color(this.textrgb)).setFont(new esri.symbol.Font(textsize)).setOffset(0, -5), {
							extent : gridExtent,
							count : pointCount
						}));
					}
					
					//timeSlider.processing = false;
				}
			}
			dataArray = null;
			data = null;
			this.onUpdateEnd();
		},
		_getColors : function() {			
			var border = 1;
			var borderalpha = 0.9;
			var textsize = 7; 
			var intervals = this.pattern.length;
			//var intervals = this.intervals + 1;

			var radiusToAdd = parseInt((this.pxgrid / intervals)) > this.size ? parseInt((this.pxgrid / intervals) - this.size) : parseInt(this.size / 2);
			var radius = this.size;			

			//var alpha = 0.3;
			var alphaToAdd = 0.11;
			var alpha = 1.0 - alphaToAdd * intervals;
			//var alphaToAdd = (1.0-alpha)/(intervals-1);

			for(var i = 0; i < intervals; i++) {
				//border = parseInt(radius / 3);
				if (!this.pattern[i]) return;
				this.pattern[i].symbol = new esri.symbol.SimpleMarkerSymbol(esri.symbol.SimpleMarkerSymbol.STYLE_CIRCLE, radius, new esri.symbol.SimpleLineSymbol(esri.symbol.SimpleLineSymbol.STYLE_SOLID, new dojo.Color(this.rgb.concat(alpha)), border), new dojo.Color(this.rgb.concat(borderalpha)));
				//alpha += alphaToAdd;
				this.pattern[i].size = radius;				
				this.pattern[i].textsize = textsize++ + "pt";
				radius += radiusToAdd;
				border += 2;
			}
		}
	});
	// end of class declaration

});
// end of addOnLoad
