RPC = Class.create({
    id : 0,
    clientid : null,
    callbacks : null,
    connected : 0,

	// [must] containerid : id of div to render swf
	// [must] path        : argument for NetConnection, something like "rtmp://wonderfl.o:1935/"
	// [optional] options : callbacks.[asyncError/ioError/netStatus/securityError]
	initialize : function( containerid, path, port, options ) {
		this.id = RPC.id++;
		this.clientid = "externalRPCClient" + this.id;
		var flashvars  = {
			id   : this.id,
			path : path,
			port : port,
			callback : "RPC.callback"
		};
		var params = {};
		params.quality = "high";
		params.allowscriptaccess = "always";
		var attributes = {};
		attributes.align = "middle";
		attributes.id = this.clientid;
        $(containerid).style.display = "block";

        // rpcclient_swf from global
		swfobject.embedSWF( rpcclient_swf, containerid, "1", "0", "9.0.0", "/swf/expressInstall.swf", flashvars, params, attributes );

		this.callbacks = new Object;
		Object.extend( this.callbacks, options.callbacks );

		RPC.instances.push( this );
	},
	call : function( func, args ) {
		for ( var key in args ) {
			if ( !args.hasOwnProperty(key) ) { continue; }
			args[key] = encodeURIComponent(args[key]);
		}

		this.getSWF().xi_call( func, args );
	},
	getSWF : function() {
		return Marshmallow.Form.getSWF(this.clientid);
	}
});
RPC.id = 0;

// static
// method : [close,connect,ioError,securityError,socketData]
RPC.instances = [];
RPC.callback = function( id, method ) {
	var instance = RPC.instances[id];
    if ( method && method == "connect" ) {
        instance.connected = 1;
    }
    if ( method && (method == "close" || method == "ioError" || method == "securityError") ) {
        instance.connected = 0;
    }
	if ( instance.callbacks[method] ) {
		return instance.callbacks[method]( arguments[2] );	// preserve this
	}
	else {
		try {
			//console.log("["+id+":"+method+"]",arguments);
		} catch (e) {}
		return true;
	}
}
