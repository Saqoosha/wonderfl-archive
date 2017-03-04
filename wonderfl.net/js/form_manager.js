if (typeof(Marshmallow) == "undefined") Marshmallow = {};
if (typeof(Marshmallow.Form) == "undefined") Marshmallow.Form = {};
Marshmallow.Form.Manager = Class.create({
	form: null,
	default_notes : null,
	args : null,
	is_validating : false,
	initialize : function( args ) {
		// must args.form
		// must args.validate_url
		//      args.post_url
		//      args.post_action これが設定されてたらsubmitせずにこの関数をよぶ
		this.args = new Object;
		Object.extend( this.args, args );
		this.form          = args.form;
		this.validate_url  = args.validate_url;
		this.post_url      = args.post_url || args.form.action;
		this.default_notes = new Object;
		$(this.form).observe('submit',this.post_validate.bindAsEventListener(this));
	},
	post_validate : function( ev ) {
		if ( this.is_validating ) {
			ev.stop();
			return;
		}
		this.is_validating = true;
		var ajax = new Ajax.Request( this.validate_url, {
			method:      "post",
			parameters:  this.form.serialize(),
			onComplete:  function(o) {
				this.is_validating = false;
				// eval for opera
				var obj = o.responseJSON || eval('('+o.responseText+')');
				if ( obj.error ) {
					this.renderErrors( obj.error );
					if ( this.args.onError ) {
						this.args.onError( obj.error );
					}
				}
				else {
					this.post();
				}
			}.bind(this)
		});
		ev.stop();
	},
	post : function() {
		if ( this.args.post_action ) {
			this.args.post_action();
		}
		else {
			this.form.submit();
		}
	},
	clearError : function(name) {
        var el = this.getElement(name);
        if ( ! el ) { return; }
		var dd = $( el.parentNode );
		dd.removeClassName('statusNG');
		dd.addClassName('statusOK');

		var note = dd.getElementsBySelector('p.notes')[0];
		if ( note && this.default_notes[name] ) {
			note.innerHTML = this.default_notes[name];
		}
	},
	clearErrors : function() {
		$(document.body).getElementsBySelector('.notes').each( function(note) {
			$(note.parentNode).removeClassName('statusNG');
			$(note.parentNode).addClassName('statusOK');
		});
		for ( var name in this.default_notes ) {
			if ( !this.default_notes.hasOwnProperty(name) ) {
				continue;
			}
            var el = this.getElement(name);
            if ( ! el ) { return el; }
            var notes = $(el.parentNode).getElementsBySelector('p.notes')[0];
			notes.innerHTML = this.default_notes[name];
		}
	},
	renderErrors : function(err) {
		this.clearErrors();
		for (var name in err) {
			if ( !err.hasOwnProperty(name) ) {
				continue;
			}
			this.renderError( name, err[name] );
		}
	},
	renderError : function(name,messages) {
        var el = this.getElement(name);
        if ( ! el ) { return; }
		var dd = $( el.parentNode );
		dd.removeClassName('statusOK');
		dd.addClassName('statusNG');

		var note = dd.getElementsBySelector('p.notes')[0];
		if ( ! this.default_notes[name] ) {
			this.default_notes[name] = note.innerHTML;
		}
		note.innerHTML     = messages.join('<br/>');
        dd.style.display = 'block';
	},
    getElement : function(name) {
        var el = $(name);
        if ( el ) { return el; }
        el = $( this.form[name] );
        if ( el && el.length ) { return el[0]; }
        return el;
    }
});

// static methods
Marshmallow.Form.getSWF = function(id) {
	return navigator.userAgent.match(/MSIE/) ? window[id] : document[id];
}


Marshmallow.Form.Uploader = Class.create({
	id : 0,
	args : null,
	callbacks : null,
	initialize : function( args ) {
		// must   args.resource   : "/swf/Uploader.swf",
		// must   args.post_url   : "/api/account/upload_icon",
		// must   args.container  : account_uploader,
		// option args.variables  : { ticket : $(this.forms.id).ticket.value },
		// must   args.callbacks  : "Koebu.Account.onUploadComplete",
		// must   args.width      : "20",
		// must   args.height     : "20"
		this.id = Marshmallow.Form.Uploader.id++;
		Marshmallow.Form.Uploader.instances.push( this );
		this.args = new Object;
		Object.extend( this.args, args );
		this.callbacks = new Object;
		Object.extend( this.callbacks, args.callbacks );
		this.render();
	},
	swf_ : null,
	swfid : null,
	swf : function() {
		if ( this.swf_ ) { return this.swf_; }
		var swfid = this.swfid = "externalUploader" + this.id;
		this.swf_ =  navigator.userAgent.match(/MSIE/) ? window[swfid] : document[swfid];
		return this.swf_;
	},
	render : function() {
		var uploaderid = "externalUploader"+this.id;
		window[uploaderid] = new Object();

		var flashvars  = {
			id       : this.id,
			post_url : this.args.post_url
		};
		for ( var key in this.args.variables ) {
			if ( !this.args.variables.hasOwnProperty(key) ) { continue; }
			flashvars[key] =this.args.variables[key];
		}
		var params = {};
		params.quality = "high";
		params.allowscriptaccess = "always";
		var attributes = {};
		attributes.align = "middle";
		attributes.id = uploaderid;

		swfobject.embedSWF( this.args.resource, this.args.container, this.args.width, this.args.height, "9.0.0", "/swf/expressInstall.swf", flashvars, params, attributes );
		if ( typeof(SWFFormFix)!="undefined" ) {
			SWFFormFix(uploaderid);
		}
	}
});

// static
// method : [cancel,complete,httpStatus,ioError,open,progress,securityError,select]
Marshmallow.Form.Uploader.id = 0;
Marshmallow.Form.Uploader.instances = [];
Marshmallow.Form.Uploader.callback = function( id, method ) {
	var instance = Marshmallow.Form.Uploader.instances[id];
	if ( instance.callbacks[method] ) {
		return instance.callbacks[method]( arguments );	// preserve this
	}
	else {
		try {
			//console.log("["+method+"]",arguments);
		} catch (e) {}
		return true;
	}
}

Marshmallow.Form.InplaceEditor = Class.create({
	id : 0,
	args : null,
	callbacks : null,
	before_edit_value : '',
	initialize : function( args ) {
		// args: hash
		//	edit_switch : 'btn_code_title_edit',
		//	target  : 'code_title',
		//	form    : 'code_title_form',
		//	input   : 'code_title_input',
		//	api : '/api/code/save',
		//	cancel : 'code_title_cancel',
		//	block  : 'boxEditInfo',
		//	additional_params : function() {
		//		ticket : this.ticket,
		//		code_uid : $('code_uid').value,
		//		as3 : $(this.as3_textarea).value
		//	}
		this.id = Marshmallow.Form.InplaceEditor.id++;
		Marshmallow.Form.InplaceEditor.instances.push( this );
		this.args = new Object;
		Object.extend( this.args, Marshmallow.Form.InplaceEditor.default_options );
		Object.extend( this.args, args );
		if ( this.args.auto_start ) {
			this.start_observing();
		}
	},
	start_observing : function() {
		var args = this.args;
		$(args.edit_switch).observe('click', function(ev) {
			ev.stop();
			$(this.args.input).value = this.before_edit_value = $(args.target).innerHTML;
			this.switch_to('form');
		}.bindAsEventListener(this) );
		$(args.form).observe('submit', function(ev) {
			ev.stop();
			var params = $(args.form).serialize().toQueryParams();
			var additional_params = (typeof(args.additional_params)=='function')
				? args.additional_params()
				: args.additional_params;
			Object.extend( params, additional_params );
			new Ajax.Request( args.api, {
				method : 'post',
				parameters : params,
				onComplete : function(o) {
					var json = o.responseJSON;
                    var result = 1;
                    if ( this.args.onComplete ) {
                        var onComplete = this.args.onComplete;
                        result &= onComplete( json );
                    }
                    if ( result ) {
			            $(args.target).update($(args.input).value);
			            this.switch_to('target');
                    }
				}.bind(this)
			});

		}.bindAsEventListener(this) );
		$(args.cancel).observe('click', function(ev) {
			ev.stop();
			this.wrap_up();
		}.bindAsEventListener(this) );
	},
	switch_to : function( target_or_form ) {
		var args = this.args;
		if ( target_or_form == 'target' ) {
			$(args.edit_switch).style.display = '';
			$(args.block).style.display   = 'none';
		}
		else {
			$(args.block).style.display   = 'block';
            $(args.input).focus();
		}
	},
	wrap_up : function() {
		$(this.args.target).value = this.before_edit_value;
		this.switch_to('target');
	},
	stop_observing : function() {
		// todo
	}
});
Marshmallow.Form.InplaceEditor.id = 0;
Marshmallow.Form.InplaceEditor.instances = [];
Marshmallow.Form.InplaceEditor.default_options = {
	auto_start : true
};


Marshmallow.Form.KeyReplacer = Class.create({
	replace_pairs : null,
	replace_keys  : null,
	initialize : function(textarea_id, replace_pairs, trigger ) {
		var textarea = this.textarea = $(textarea_id);
		if ( ! textarea ) { throw('[Marshmallow.Form.KeyReplacer]textarea: '+textarea_id+' not found'); return; }

		this.replace_pairs = replace_pairs;
		this.replace_keys  = new Array;
		for ( var key in replace_pairs ) {
			if ( ! replace_pairs.hasOwnProperty(key) ) { return; }
			this.replace_keys.push(key);
		}
		textarea.observe(trigger || 'keydown',function(e) {
            var do_replace = this.is_replace_subject(e.keyCode);
			if ( do_replace ) {
                //console.log('[keydown]e: ',e);
                if ( this.replace_pairs[e.keyCode].hasOwnProperty("replace_with") ) {
                    // 明示的な置換先があれば置換
				    this.input_these( this.replace_pairs[e.keyCode]["replace_with"] );
				    e.stop();
                }
                else if ( this.replace_pairs[e.keyCode].hasOwnProperty("do") ) {
                    // なんかする
                    var func = this.replace_pairs[e.keyCode]["do"];
                    func( e, this );
                }
			}
		}.bindAsEventListener(this));
	},
	is_replace_subject : function( key ) {
		return this.replace_keys.any( function(replace_key) { return key == replace_key } );
	},
	input_these : function( str ) {
		if ( Prototype.Browser.IE ) {
			var range = document.selection.createRange();
			range.text = str;
			range.select();
		}
		else {
			var scrollTop = this.textarea.scrollTop;
			var value = this.textarea.value;
			var here  = this.textarea.selectionStart;
			this.textarea.value = value.substr(0,here) + str + value.substr(here,value.length);
			var next_cursor = here + str.length;
			this.textarea.setSelectionRange( next_cursor, next_cursor );
			this.textarea.scrollTop = scrollTop;
		}
	}
});

Marshmallow.Form.InputPrompt = Class.create({
    default_text: null,
    onComplete: null,
    initialize: function( args ) {
        if ( Prototype.Browser.IE ) { return; } // bye bye

        this.default_text = args.default_text;
        this.input        = $(args.input);

        this.input.observe( 'focus', this.on_focus.bindAsEventListener(this) );
        this.input.observe( 'blur',  this.on_blur.bindAsEventListener(this) );
        this.on_blur();

        // find parent form
        if ( ! this.form ) {
            var element = this.input;
            while (element = element.parentNode) {
                if (element.tagName == "FORM") {
                    break;
                }
            }
            this.form = element;
        }
        this.form = this.form ? $(this.form) : null;

        if ( this.form ) {
            // cleanup on submit
            this.form.observe( 'submit', function(ev) {
                if ( this.input.value == this.default_text ) {
                    this.input.value = "";
                    this.input.removeClassName('input-prompt');
                }
            }.bindAsEventListener(this));
        }
    },
    on_focus: function( ev ) {
        if ( this.input.value == this.default_text ) {
            this.set_text('');
            this.input.removeClassName('input-prompt');
        }
    },
    on_blur: function( ev ) {
        if (this.input.value == '') {
            this.set_text( this.default_text );
        }
        if ( this.input.value == this.default_text ) {
            this.input.addClassName('input-prompt');
        }
    },
    set_text: function( text ) {
        this.input.value = text;
    }
});

Marshmallow.Form.SmartCandidates = Class.create({
    initialize: function( args ) {
        this.candidates = args.candidates;
        this.target     = $(args.target);
        this.on_click   = args.on_click;

        this.candidates.each( function(el) {
            el.observe('click', function(ev) {
                ev.stop();

                if ( this.on_click ) {
                    this.on_click( this.target, el );
                }

                var str = ev.element().innerHTML;
                var temptags = this.target.value.split(' ').grep(/.+/);
                temptags.push(str);
                temptags = temptags.uniq();
                this.target.value = temptags.join(' ');
                this.target.focus();
            }.bindAsEventListener(this));
        }.bind(this));
    }
});

