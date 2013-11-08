dojo.provide("stream.StreamService");

/**
  StreamService
  params:
    url - URL string to a AGS Instance
    options - An object with custum settings for any public properties

*/
dojo.declare("stream.StreamService", null, {
    constructor: function(url, options, callback, errorCallback) {

      if (this._validate( options )) {
        this._send(url, options, callback, errorCallback);
      } else {
        errorCallback && errorCallback( 'Invalid options' );
      }

    },

    _fieldTypeValids: [
      'esriFieldTypeGeometry',
      'esriFieldTypeString',
      'esriFieldTypeInteger',
      'esriFieldTypeSmallInteger',
      'esriFieldTypeDate',
      'esriFieldTypeDouble',
      'esriFieldTypeOID'
    ],

    _validate: function( options ){
      var self = this;

      var isValid = true,
        hasOID = false;

      // no fields, then fail
      if ( !options.fields ) return false;

      // check each field type
      options.fields.forEach(function( f, i ){
        if ( f.type == 'esriFieldTypeOID' ) hasOID = true;
        if ( dojo.indexOf( self._fieldTypeValids,  f.type) == -1 ) {isValid = false;
        console.log("name:",f.name,"type:",f.type);}
      });

      // no OID, then fail
      if ( !hasOID ) isValid = false;
      return isValid;
    },

    // Send the request to given url
    _send: function(url, options, callback, errorCallback){
      console.log('URL', url, JSON.stringify(options))
      dojo.xhrPost({
        url: url,
        postData: dojo.toJson(options),
        handleAs: 'json',
        headers: { "Content-Type": "application/json"},
        user:'socialdemo',
        password:'esrirules',
        load: function(data){
          callback && callback(data);
        },
        error: function(error){
          errorCallback && errorCallback( error );
        }
      });
    }
});

