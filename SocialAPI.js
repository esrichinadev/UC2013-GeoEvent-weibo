dojo.provide("social.SocialAPI");

/**
  Wrapper for Esri's ArcGIS Social API
**/
dojo.declare("stream.SocialAPI", null, {
    constructor: function( options ) {
      this.host = options.host;
      this.stream_path = '/streams';
    },

    // creates a new StreamService in AGS
    stream: function( type, options, callback ){
      /*
        docs: https://github.com/ArcGIS/social/wiki/Stream
      */

      var self = this;

      var url = self.host + self.stream_path;

      var _req = {
        'create': function( opts, cb ){

          dojo.xhrPost({
            url: url + '.json',
            postData: dojo.toJson( opts ),
            handleAs: 'json',
            headers: { "Content-Type": "application/json"},
            load: function(data){
              cb && cb( null, data );
            },
            error: function(error){
              cb && cb( error, null );
            }
          });

        },
        'read': function( opts, cb ){

          if ( opts.id ) {
            url += '/' + opts.id + '.json';
          }
          dojo.xhrGet({
            url: url,
            handleAs: 'json',
            load: function( data ){
              cb && cb( null, data );
            },
            error: function( error ){
              cb && cb( error, null );
            }
          });

        },
        'update': function( opts, cb ){
          if ( opts.id ) {
            url += '/' + opts.id;
            dojo.xhrPut({
              url: url,
              handleAs: 'json',
              load: function( data ){
                cb && cb( null, data );
              },
              error: function( error ){
                cb && cb( error, null );
              }
            });
          }
        },
        'delete': function( opts, cb ){
          if ( opts.id ) {
            url += '/' + opts.id;
            dojo.xhrDelete({
              url: url,
              handleAs: 'json',
              load: function( data ){
                cb && cb( null, data );
              },
              error: function( error ){
                cb && cb( error, null );
              }
            });
          }
        }
      };

      _req[type]( options, callback );

    },

});

