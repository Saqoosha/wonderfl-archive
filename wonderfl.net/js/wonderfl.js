// utils
function getElementsByIdPrefix(prefix){
    // thanks to amachang
    var ret = [];
    for( var i=0; true; i++ ){
        var el = $(prefix+i);
        if( !el ){ break; }
        ret.push(el);
    }
    return ret;
}

function l(text) {
    switch( text ) {
    case "お気に入りに追加済":
        return lang=="ja" ? text : "added to favorites";
    case "フォロー済":
        return lang=="ja" ? text : "following";
    case "このユーザーをフォロー解除します\nよろしいですか？":
        return lang=="ja" ? text : "Really unfollow this user ?";
    case "500kB以内の画像ファイルを選択してください":
        return lang=="ja" ? text : "upload image files up to 500kB";
    case "このIDと現在のアカウントの連携を解除します\nよろしいですか？":
        return lang=="ja" ? text : "Really disable this id to sign in as current account?";
    case "操作方法、工夫した点、解説したい内容、こだわったところや参考文献のURL等を書いてください\n書かない場合、クラス宣言までのコメント文から自動抽出します":
        return lang=="ja" ? text : "How to interact with this?\nWhat inspired you?\nCore logic explanation?\nor requests for viewers?\nIf this field is left blank, description will be auto extracted from code comments.";
    case "空白区切りで複数入力できます":
        return lang=="ja" ? text : "Space separated tags";
    default:
        throw("error in l(), text: "+text);
    }
}

if (typeof(Wonderfl) == "undefined") Wonderfl = {};
Wonderfl.Compiler = new function() {
    return {
        editor_is_flash    : 0,
        swf_id             : "externalFlashEditor",
        html_editor_id     : "html_editor",
        editor             : null,
        editor_initialized : 0,
        form_observer      : null,
        ticket             : null,
        rpc                : null,
        capture            : null,
        message            : "",
        last_compiled_code : "",
        is_auto_compiling  : true,
        reload_trigger     : /Compile Complete \([0-9]+ bytes\)\r?\n?Reloading swf/gim,
        message_parser     : null,
        stop_button        : null,
        reload_button      : null,
        load : function() {
            if ( ! $(this.swf_id) && ! $(this.html_editor_id) ) { return; }

            this.ticket               = $("ticket").value;
            this.code_uid             = $("code_uid").value;
            this.set_message("Loading... Please Wait...\n");
            this.form                 = $("code_title_form");

            this.init_editor();
            this.init_compiler();
            this.init_capture();
            this.add_button_listeners(); // for stop,reload

            // 保存ボタン
            var btn_save = $('saveCode');
            if ( btn_save ) {
                btn_save.observe('click', function(ev) {
                    ev.stop();
                    this.get_code_and_save();
                }.bindAsEventListener(this));
            }
            // 保存 & 終了ボタン
            var btn_finish = $('finishCode');
            if (btn_finish) {
                btn_finish.observe('click', function(ev) {
                    ev.stop();
                    this.get_code_and_save_and_finish();
                }.bindAsEventListener(this));
            }

            // title editor
            this.init_title_editor();

            // auto compile checkbox
            this.init_autocompile_checkbox();

            // more button
            this.init_more_info();

            height = document.viewport.getHeight() - 40 - 12 - $("message").cumulativeOffset()[1];
            height = height > 100 ? height : 100;
            $("message").setStyle({ height: height + "px" });
        },
        init_hilighter : function() {
            if ( this.hilighter ) { return; }

            var pattern = new RegExp("(?:\\.as|\\.mxml)\\(([0-9]+)\\).*?col: ([0-9]+) (.*)");
            this.hilighter = new Wonderfl.Compiler.MessageParser( pattern, function() {
                // $1 : row number
                // $2 : col number
                // $3 : message
                //console.log( RegExp.$1 + "," + RegExp.$2 + "," + RegExp.$3 );
                this.set_error( RegExp.$1, RegExp.$2, RegExp.$3 );
            }.bind(this) );
        },
        set_error : function( row_number, col_number, message ) {
            var swf = this.find_editor();
            if ( ! swf ) { return; }
            if ( typeof( swf.xi_set_error ) == "undefined" ) { return; }

            swf.xi_set_error( row_number, col_number, message );
        },
        init_editor : function() {
            if ( $(this.swf_id) ) {
                // setup flash editor
                this.editor_is_flash = 1;

                var flashvars = {
                    server : compiler_server,
                    port   : compiler_port,
                    room   : this.code_uid,
                    ticket : this.ticket
                };
                if ( typeof(viewer) == "object" ) {
                    flashvars["viewer.displayName"] = viewer.displayName;
                    flashvars["viewer.iconURL"]     = viewer.iconURL;
                }

                var params    = {
                    quality           : "high",
                    allowfullscreen   : "true",
                    allowscriptaccess : "always"
                };

                var attributes = {
                    align : "middle",
                    id    : "externalFlashEditor",
                    name  : "externalFlashEditor"
                };

                // editor_swf from global
                swfobject.embedSWF( editor_swf, this.swf_id, "100%", "100%", "11.0.0", "/swf/expressInstall.swf", flashvars, params, attributes );
            }
            else {
                // setup html textarea editor
                this.form_observer = new Wonderfl.Compiler.Observer(this.html_editor_id, function() {
                    this.reset_message();
                    this.onCodeChanged();
                }.bindAsEventListener(this));
                
                // textarea keyboard hacker 
                this.init_keyreplacer(); 

                // init scale button
                //Wonderfl.Codepage.init_scale_button( this.html_editor_id );
            }
        },
        edit_complete : function() {
            // dont compile if editor not initialized
            if ( ! this.editor_initialized ) { return; }

            setTimeout( function() {
                // do compile
                this.reset_message();
                this.onCodeChanged();
            }.bind(this), 0 );
        },
        get_initial_code : function() {
            // called from editor.swf
            // editor.swfがリロードしてもokなように
            this.editor_initialized = 1;

            this.init_hilighter();

            return this.last_compiled_code || $('raw_as3').value.replace(/\r\n/g, '\n'); // replace for IE8
        },
        take_capture : function () {
            if (!this.capture) {
                this.capture = navigator.userAgent.match(/MSIE/) ? window[this.capture_swf_id] : document[this.capture_swf_id];
            }
            var swf = this.capture;
            if ( ! swf ) { return; }
            if ( typeof( swf.xi_take_capture ) == "undefined" ) { return; }

            swf.xi_take_capture();
            return;
        },
        get_stage_size : function() {
            var dimensions = $(this.swf_id).getDimensions();
            return [ dimensions.width, dimensions.height ];
        },
        get_code : function() {
            if ( this.editor_is_flash ) {
                var swf = this.find_editor();
                if ( ! swf ) { return; }
                if ( typeof( swf.xi_get_code ) == "undefined" ) { return; }

                var code = swf.xi_get_code();
                code = decodeURIComponent( code ).replace(/\r/g,'\n');
                return code;
            }
            else {
                return $(this.html_editor_id).value;
            }
        },
        notify_editor_swf_reloaded : function() {
            var swf = this.find_editor();
            if ( ! swf ) { return; }
            if ( typeof( swf.xi_swf_reloaded ) == "undefined" ) { return; }

            swf.xi_swf_reloaded();
        },
        find_editor : function() {
            if ( this.editor ) {
                return this.editor;
            }
            this.editor = navigator.userAgent.match(/MSIE/) ? window[this.swf_id] : document[this.swf_id];
            return this.editor;
        },
        get_code_and_save : function() {
            var code = this.get_code();
            if ( ! code ) { return; }

            this.save({
                ticket   : this.ticket,
                code_uid : this.code_uid,
                as3      : code
            }, 0); // non auto
        },
        get_code_and_save_and_finish : function() {
            var code = this.get_code();
            if ( ! code ) { return; }

            this.save({
                ticket   : this.ticket,
                code_uid : this.code_uid,
                as3      : code
            }, 0, function() { // non auto
                location.href = "/c/" + code_uid;
            });
        },
        save : function( params, auto, callback ) {
            new Ajax.Request( '/api/code/save', {
                method: "post",
                parameters: params,
                onComplete: function(o) {
                    var json = o.responseJSON;
                    //console.log("code save complete: ",json);
                    var message = '';
                    if ( json.error ) {
                        message = this.extract_error_message(json.error);
                        this.set_message( message + "\n" );
                        if ( json.error_line ) {
                            this.set_error( json.error_line, 1, message );
                        }
                    }
                    else {
                        this.append_message( auto ? 'Auto Saved\n' : 'Saved\n' );
                        message = json.result.message;
                        if ( message ) {
                            this.append_message( message );
                        }
                        if ( json.result.license == "GPL" ) {
                            // license automatically changed, because you used GPL libraries
                            var input = $('license_GPL');
                            if ( input ) { 
                                input.checked = "checked";
                            }
                            var license_text = $('license_text');
                            if ( license_text ) {
                                license_text.innerHTML = 'license : <a href="/help#help_license">GPL License</a>';
                            }
                        }
                    }
                    if (callback) callback();
                }.bind(this)
            });
        },
        init_compiler : function() {
            // compiler_server from global
            this.rpc = new RPC( "rpc_container", compiler_server, compiler_port, {
                callbacks : {

                    connect : function( args ) {
                        this.set_message('Connected to Compiler Server.\n');
                        this.onCodeChanged();
                    }.bind(Wonderfl.Compiler),

                    socketData : function( args ) {
                        this.append_message( args.text );
                        if ( this.hilighter ) {
                            this.hilighter.push( args.text );
                        }

                        if ( args.text.match( this.reload_trigger ) ) {
                            this.save({
                                ticket   : this.ticket,
                                code_uid : this.code_uid,
                                as3      : this.last_compiled_code,
                                compile_ok : 1
                            }, 1); // auto
                            this.play();
                            this.notify_editor_swf_reloaded();
                        }
                    }.bind(Wonderfl.Compiler),

                    close : function( args ) {
                        this.append_message( '[ERROR]Connection Closed, Something Wrong, Reconnecting...\n' );
                    }.bind(Wonderfl.Compiler),

                    securityError : function( args ) {
                        this.set_message( '[ERROR]Couldnt Connect with Server, Reconnecting...\n' );
                    }.bind(Wonderfl.Compiler)

                }
            });
        },
        init_capture : function () {
            var flashvars  = {
                code_uid : code_uid,
                ticket : this.ticket,
                swf_server : swf_server
            };
            var containerid =  "capture_container";
            var params = {};
            params.quality = "low";
            params.allowscriptaccess = "always";
            var attributes = {};
            attributes.align = "middle";
            attributes.id = "externalTakeCapture";
            this.capture_swf_id = attributes.id;
            $(containerid).style.display = "block";

            // capture_swf from global
            swfobject.embedSWF( capture_swf, containerid, "1", "0", "11.0.0", "/swf/expressInstall.swf", flashvars, params, attributes );
        },
        clear_title_editor_errors : function() {
            $('code_title_form').select('td').each( function(el) {
                el.removeClassName('statusNG');
            });
            var license_note = $('license_notes');
            if ( license_note ) {
                license_note.innerHTML = '';
            }
        },
        init_keyreplacer : function() { 
            // replace tab => white space x 4 
            this.keyreplacer = new Marshmallow.Form.KeyReplacer( this.html_editor_id,{ '9'  : { replace_with : '    ' } }); 
              
            // replace enter => auto indent 
            // キーアップで前の行の先頭の半角空白を繰り返す 
            this.autoindenter = new Marshmallow.Form.KeyReplacer( this.html_editor_id,{ '13' : { 
                'do' : function( event, replacer ) { 
                    if ( Prototype.Browser.IE ) { return; } // you're unlucky 
                    var here  = replacer.textarea.selectionStart; 
                    var before_here = replacer.textarea.value.substr(0, here); 
                    var last_line = before_here.match(/\n([ ]*).*?(\{?)\n$/); 
                    var next_space_length = last_line[1].length; 
                    if ( last_line[2] ) { 
                        next_space_length += 4; 
                    } 
                    next_space_length = (next_space_length<0) ? 0 : next_space_length; 
                    
                    var str = ''; 
                    for ( var i=0; i<next_space_length; i++ ) { 
                        str += ' '; 
                    } 
                    replacer.input_these( str ); 
                } 
            }},'keyup'); 
        },

        onCodeChanged : function() {
            if ( ! this.is_auto_compiling ) { return; }
            if ( ! this.rpc.connected )     { return; }
            var code = this.get_code();

            // dont compile twice
            if ( this.last_compiled_code && this.last_compiled_code == code ) { return; }

            this.rpc.call("compile",{
                code   : code,
                ticket : this.ticket
            });
            this.last_compiled_code = code;
            this.append_message( 'Sending Code to Compiler Server...\n' );
            
            return;
        },

        init_title_editor : function() {
            new Marshmallow.Form.InputPrompt({
                form: 'code_title_form',
                input: 'description',
                default_text: l("操作方法、工夫した点、解説したい内容、こだわったところや参考文献のURL等を書いてください\n書かない場合、クラス宣言までのコメント文から自動抽出します")
            });
            new Marshmallow.Form.InputPrompt({
                form: 'code_title_form',
                input: 'tags',
                default_text: l("空白区切りで複数入力できます")
            });
            new Marshmallow.Form.SmartCandidates({
                candidates: $$(".tag"),
                target: $("tags"),
                on_click: function( target, clicked_element ) { // before click hook
                    if ( target.hasClassName('input-prompt') ) {
                        target.removeClassName('input-prompt');
                        target.value = '';
                    }
                }
            }); // InputPromptとかぶったら

            this.clear_title_editor_errors();
            this.inplace_editor = new Marshmallow.Form.InplaceEditor({
                edit_switch : 'ttlCode',
                target  : 'ttlCodeText',
                form    : 'code_title_form',
                input   : 'ttl',
                api     : '/api/code/save',
                cancel  : 'cancelEdit',
                block   : 'boxEditInfo',
                additional_params : function() {
                    return {
                        ticket               : this.ticket,
                        code_uid             : this.code_uid,
                        from_title_editor    : 1
                    };
                }.bind(this),
                onComplete : function( json ) {
                    if ( json.error ) {
                        for ( var key in json.error ) {
                            if ( ! json.error.hasOwnProperty(key) ) { continue; }
                            var message = json.error[key].join('<br/>');
                            var input   = this.form[key];
                            input       = ( input && typeof(input.length)=="number" ) ? input[0] : input; // licenseはinputがたくさんあるからne
                            var parent  = $( input.parentNode );
                            parent.addClassName('statusNG');
                            var notes   = parent.select('.notes')[0];
                            notes.innerHTML = '[ERROR]' + message;
                        }

                        if ( json.error_line ) {
                            this.set_error( json.error_line, 1, json.error[ "license" ].join(', ') );
                        }
                    }
                    else {
                        var text = {
                            "all": "All rights reserved",
                            "MIT": "MIT License",
                            "GPL": "GPL License",
                            "other": "see code comments"
                        };
                        var license = $('code_title_form').serialize().toQueryParams()["license"];
                        this.clear_title_editor_errors();
                        this.append_message( 'Saved\n' );
                    }
                    return json.error ? false : true;
                }.bind(this)
            });
        },
        init_autocompile_checkbox : function() {
            var auto_cb  = $('autoCompile');
            if (! auto_cb) { return; }

            auto_cb.observe('change', function(ev) {
                this.is_auto_compiling = auto_cb.checked;
            }.bindAsEventListener(this) );
        },
        init_more_info : function() {
            this.related_image_uploader = new Marshmallow.Form.Uploader({
                resource   : "/swf/Uploader.swf",
                post_url   : "/api/code/relatedimages",
                container  : "related_image_uploader",
                width      : "59",
                height     : "20",
                variables  : {
                    directupload : true
                },
                callbacks  : {
                    select        : function( args ) {
                        var fileinfo = this.fileinfo = args[2]; // [id,event,fileinfo]
                        if ( ( fileinfo && fileinfo.size >= 500 * 1024 * 1024 )
                             || ( !fileinfo.name.match(/\.(jpg|gif|bmp|png)$/i) ) ) {
                            var msg = l("500kB以内の画像ファイルを選択してください");
                            $('related_image_uploader_note').innerHTML = msg;
                            alert(msg);
                            return false;
                        }
                        return true;
                    }.bind(this),
                    uploadCompleteData : function( args ) {
                        var image_uid = args[2];
                        $('related_images_container').innerHTML
                            += '<div class="related_image_temp" id="related_image_'+image_uid+'">'
                             + '<img width="90" width="120" src="/static/tmp/related_images/'+image_uid+'m"/><br/>'
                             + '<a href="#" onclick="return Wonderfl.Compiler.delete_related_image(\''+image_uid+'\');">delete</a>'
                             + '<input type="hidden" name="related_image" value="'+image_uid+'" />'
                             + '</div>';
                    }.bind(this),
                    httpStatus    : this.onIOError.bind(this),
                    securityError : this.onIOError.bind(this),
                    ioError       : this.onIOError.bind(this)
                }
            });
        },
        add_button_listeners : function() {
            this.play_button   = $('btnPlay');
            this.stop_button   = $('btnStop');
            this.reload_button = $('btnReload');
            this.capture_button = $('btnCapture');
            if (this.play_button) {
                this.play_button.observe('click', function(ev) {
                    this.play();
                }.bindAsEventListener(this));
            }
            if (this.stop_button) {
                this.stop_button.observe('click', function(ev) {
                    Wonderfl.Renderer.show_play_button();
                    this.play_button  .show();
                    this.stop_button  .hide();
                    this.reload_button.hide();
                    this.capture_button.hide();
                    ev.stop();
                }.bindAsEventListener(this) );
            }
            if ( this.reload_button ) {
                this.reload_button.observe('click', function(ev) {
                    this.play();
                    ev.stop();
                }.bindAsEventListener(this) );
            }
            if ( this.capture_button ) {
                this.capture_button.observe('click', function(ev) {
                    this.take_capture();
                    ev.stop();
                }.bindAsEventListener(this) );
            }
        },
        scale_down : function() {
            $("wrapper").removeClassName("ctrl3");

            Event.stopObserving(window, 'resize', Wonderfl.Compiler.reset_as3_container_width );
            $('as3_container').style.width = '100%';

            var scale_btn = $("scale_button_container");
            if ( scale_btn ) {
                scale_btn.style.display = "none";
            }
        },
        reset_as3_container_width : function() {
            // prototype.js dependency
            $('as3_container').style.width = (document.viewport.getWidth() - 465) + 'px';
        },
        delete_related_image : function( image_uid ) {
            var related_image = $('related_image_'+image_uid);
            related_image.parentNode.removeChild( related_image );
            return false;
        },
        onIOError : function( args ) {
            var error = args[2];
            $('related_image_uploader').innerHTML = error;
        },
        extract_error_message : function( err ) {
            var message = [];
            for ( var name in err ) {
                if ( !err.hasOwnProperty(name) ) { continue; }
                message.push( err[name].join('\n') );
            }
            return message.join('\n');
        },
        append_message : function( text ) {
            this.message += text;
            try {
                $("message").value = this.message;
            } catch(e) {}
        },
        set_message : function( text ) {
            this.message = text;
            try {
                $("message").value = text;
            } catch(e) {}
        },
        reset_message : function() {
            this.message = '';
            try {
                $("message").value = '';
            } catch(e) {}
        },
        build_swffilepath : function( avoid_cache ) {
            // swf_uri from global
            return swf_uri + (avoid_cache ? ("?t="+(new Date).getTime()) : '');
        },
        play : function() {
            var swf = this.build_swffilepath( true );
            // dont show noswf for "build from scratch"
            if (Wonderfl.Compiler.play_button) {
                Wonderfl.Compiler.play_button.hide();
            }
            if ( ! Wonderfl.Renderer.swf_container_inner_html ) {
                Wonderfl.Renderer.swf_container_inner_html = '<div id="swf"><img src="/img/common/thumb_nowcapturing_465.png" width="465" height="465" /><a href="javascript:void(0);" id="play_button" onclick="Wonderfl.Compiler.play(); return false;"><img src="/img/common/play_button_o.png" alt="play" class="iepngfix btn" /></a></div>';
            }
            Wonderfl.Renderer.render( swf, { ticket: this.ticket, code_uid: this.code_uid } );
            this.stop_button  .show();
            this.reload_button.show();
            this.capture_button.show();
        }
    };
};

Wonderfl.Compiler.MessageParser = Class.create({
    nonfinished_message : "",
    pattern : null,
    callback : null,
    initialize : function( pattern, callback ) {
        this.pattern             = pattern;
        this.callback            = callback;
        this.nonfinished_message = "";
    },
    push : function( str ) {
        var target_string = this.nonfinished_message + str;
        var lines         = target_string.split("\n");
        // skip empty string if target_string ends with "\n"
        if ( lines[ lines.length - 1 ] === "" ) {
            lines.pop();
        }
        else {
            this.nonfinished_message = lines.pop();
        }

        // それぞれの行について、patternにマッチしたらイベントを発火
        var lines_count = lines.length;
        for ( var i=0; i<lines_count; i++ ) {
            if ( lines[ i ].match( this.pattern ) ) {
                this.callback();
            }
        }
    }
});

Wonderfl.Compiler.Observer = Class.create({
    time : 1500,
    timer : null,
    callback : null,
    initialize : function( textarea, callback ) {
        this.textarea = $(textarea);
        this.callback = callback;
        this.observer = new Form.Element.Observer(this.textarea, 0.2, this.onTextareaChanged.bind(this));
        this.textarea.observe('keydown', function(e) {
            this.postponeDispatch();
        }.bindAsEventListener(this));
    },
    postponeDispatch : function() {
        // postpone when timer is ticking, do nothing if it's nothing
        if ( this.timer ) {
            clearTimeout( this.timer );
            this.timer = setTimeout( this.dispatch.bind(this), this.time );
        }
    },
    onTextareaChanged : function() {
        //console.log('[onTextareaChanged]changed');
        if ( this.timer ) {
            clearTimeout( this.timer );
        }
        this.timer = setTimeout( this.dispatch.bind(this), this.time );
    },
    dispatch : function() {
        //console.log('[dispatch]');
        this.timer = null;
        var callback = this.callback;
        callback( this.textarea );
    }
});

Wonderfl.Renderer = new function() {
    return {
        swf_container_inner_html : '',
        render : function( swf, flashvars, more_params ) {
            if ( ! this.swf_container_inner_html ) {
                this.swf_container_inner_html = $("swf_container").innerHTML; // preserve for stop
            }

            // cleanup
            $("swf_container").innerHTML = "<div id=\"swf\"></div>";

            flashvars  = flashvars ? flashvars : {};
            if ( typeof(open_api_key) == "string" ) {
                flashvars["open_api_key"] = open_api_key;
            }
            // google maps for flashvars
            if ( typeof(google_maps_key) == "string" ) {
                flashvars["key"] = google_maps_key;
            }
            if ( typeof(code_uid) == "string" ) {
                flashvars["appId"] = code_uid;
            }
            if ( typeof(viewer) == "object" ) {
                flashvars["viewer.displayName"] = viewer.displayName;
                flashvars["viewer.iconURL"]     = viewer.iconURL;
            }

            flashvars["domain"] = location.hostname || location.host;

            var params = {};
            params.quality = "high";
            params.allowfullscreen = "true";
            if (wmode) {
                params.wmode = wmode;
            }
            if ( more_params ) {
                Object.extend( params, more_params );
            }
            
            var attributes = {
                align : "middle",
                id    : "externalFlashContent",
                name  : "externalFlashContent"
            };
            swfobject.embedSWF( swf, "swf", "465", "465", "11.0.0", "/swf/expressInstall.swf", flashvars, params, attributes );
        },
        show_play_button : function() {
            $("swf_container").innerHTML = this.swf_container_inner_html;
        }
    };
};

Wonderfl.Account = new function() {
    return {
        form : null,
        form_manager : null,
        init : function() {
            this.form = $('form_account');
            if ( ! this.form ) { return; }

            this.form_manager = new Marshmallow.Form.Manager({
                form         : this.form,
                validate_url : '/api/account/validate',
                onError      : function(err) {
                    window.scrollTo(0,0);
                }
            });
            this.ticket   = this.form.ticket.value;

            this.uploader = new Marshmallow.Form.Uploader({
                resource   : "/swf/Uploader.swf",
                post_url   : "/api/account/upload_icon",
                container  : "account_image_select_button",
                width      : "59",
                height     : "20",
                variables  : {
                    ticket       : this.ticket,
                    directupload : true
                },
                callbacks  : {
                    select        : this.onSelect.bind(this),
                    open          : this.onOpen.bind(this),
                    progress      : this.onProgress.bind(this),
                    complete      : this.onUploadComplete.bind(this),
                    httpStatus    : this.onStatus.bind(this),
                    securityError : this.onIOError.bind(this),
                    ioError       : this.onIOError.bind(this)
                }
            });
        },
        load : function() {
            // icon削除
            var icon_deleter = $('account_icon_delete_button');
            if ( icon_deleter ) {
                icon_deleter.observe('click',function(ev) {
                    ev.stop();
                    $('account_icon_delete_button').style.display = 'none';
                    new Ajax.Request( '/api/account/delete_icon', {
                        method: "post",
                        parameters: {
                            ticket: this.ticket
                        },
                        onComplete: function(o) {
                            var json = o.responseJSON;
                            //console.log("icon delete complete: ",json);
                            $('account_icon_container').innerHTML = "";
                        }
                    });
                }.bindAsEventListener(this));
            }

            // 認証情報削除
            var identifier_deleter = $$(".identifierDelete");
            if (identifier_deleter) {
                var ticket = this.ticket;
                identifier_deleter.each(function(deleter) {
                    var realm = deleter.select("input").first().value;
                    var url   = deleter.select("a").first().identify();
                    deleter.observe("click", function(ev) {
                        ev.stop();
                        if (! confirm(l('このIDと現在のアカウントの連携を解除します\nよろしいですか？'))) { return; }
                        new Ajax.Request('/api/account/identifiers/destroy', {
                            method : 'post',
                            parameters : {
                                ticket : ticket,
                                url    : url,
                                realm  : realm
                            },
                            onComplete: function(o) {
                                var json = o.responseJSON;
                                if (json.result == "ok") {
                                    deleter.ancestors()[0].remove();
                                }
                                if ($$(".identifierDelete").length == 0) {
                                    $("has_other_identifiers").remove();
                                }
                            }
                        });
                    }.bindAsEventListener(this));
                });
            }
        },
        onSelect : function( args ) {
            var fileinfo = this.fileinfo = args[2]; // [id,event,fileinfo]
            if ( ( fileinfo && fileinfo.size >= 500 * 1024 * 1024 )
              || ( !fileinfo.name.match(/\.(jpg|gif|bmp|png)$/i) ) ) {
                var msg = "500kB以内の画像ファイルを選択してください";
                alert(msg);
                this.form_manager.renderError("upload_icon",[msg]);
                return false;
            }
            return true;
        },
        onOpen : function( args ) {},
        onProgress : function( args ) {},
        onUploadComplete: function() {
            $('account_icon_container').innerHTML = "<img src='/static/tmp/icon/"+this.ticket+"?t="+(new Date).getTime()+"' width=100 height=100 />";
            $('account_icon_delete_button').style.display = 'block';

            this.form_manager.clearError("upload_icon");
        },
        onStatus : function( args ) {
            var status = args[2];
            var error;
            switch (status) {
            case 403:               // require ticket
            case 404:               // no such ticket
                // 不正なリクエストかセッション切れ。リロードを促す
                error = "アップロードセッションが期限切れになりました。ページをリロードしてからやり直してください。";
                break;
            case 500:               // server error. failed to save mp3
                error = "アップロード中にサーバーエラーが発生しました。やり直してみてください。";
                break;
            case 501:               // unsupported media type
                error = "このファイルはアップロードできませんでした。不正なmp3ファイルです。";
                break;
            default:
                break;
            }

            if (!error) error = "Unknown Error";

            this.fileinfo = null;
            this.form_manager.renderError("upload_icon", [error]);

            $("file_form").style.visibility     = "visible";
            $("file_progress").style.visibility = "hidden";
        },
        onIOError : function( args ) {
            var error = args[2];
            this.form.file.value = "";
            this.fileinfo = null;
            this.form_manager.renderError("file", [error,"リロードして再度お試しください。"]);
            $("file_form").style.visibility     = "visible";
            $("file_progress").style.visibility = "hidden";
        }
    };
};

Wonderfl.APIKeys = new function() {
    return {
        form : null,
        form_manager : null,
        init : function() {
            this.form = $('form_api_key');
            if ( ! this.form ) { return; }

            this.form_manager = new Marshmallow.Form.Manager({
                form         : this.form,
                validate_url : '/api/account/api_keys/validate',
                onError      : function(err) {
                    window.scrollTo(0,0);
                }
            });
        },
        load : function() {
        }
    };
};

if (typeof(Effect) == "undefined") Effect = {};
if (typeof(Effect.Base) == "undefined") Effect.Base = {};
Effect.HeightScaler = Class.create(Effect.Base, {
    initialize: function(element) {
        this.element = $(element);
        var options  = Object.extend({ }, arguments[1] || { });
        this.start(options);
    },
    update: function(position) {
        this.element.style.height = position + "px";
    }
});

Wonderfl.Index = new function() {
    return {
        effect: null,
        swf_container: "boxIndexSWF",
        load : function() {
            if ( location.pathname != "/" ) { return; }

            // all from global
            var flashvars = {
            };
            var params    = {
                quality           : "high",
                allowscriptaccess : "always",
                wmode             : "transparent"
            };
            var attributes = {
                align : "middle"
            };

            // viewer_swf from global
            swfobject.embedSWF( index_swf, this.swf_container, "950", "322", "11.0.0", "/swf/expressInstall.swf", flashvars, params, attributes );
        },
        open : function() {
            Wonderfl.cookie('guide_visibility', 'show', { expires: 365 });

            if ( this.effect ) { return; }
            this.effect = new Effect.Parallel([
                new Effect.SlideUp('indexGuide'),
                new Effect.HeightScaler('boxIndexSWF', {
                    from: 0,
                    to: 322,
                    beforeStart: function() {
                        $('indexSWF').style.display       = "block";
                        $('boxIndexSWF').style.display    = "block";
                        $('boxIndexSWF').style.visibility = "visible";
                    },
                    afterFinish: function() {
                        this.effect = null;
                    }.bind(this)
                })
            ]);
        },
        close : function() {
            Wonderfl.cookie('guide_visibility', 'hidden', { expires: 365 });

            if ( this.effect ) { return; }
            this.effect = new Effect.Parallel([
                new Effect.SlideDown('indexGuide'),
                new Effect.HeightScaler('boxIndexSWF', {
                    from: 322,
                    to: 0,
                    afterFinish: function(){
                        $('boxIndexSWF').style.visibility = "hidden";
                        this.effect = null;
                    }.bind(this)
                })
            ]);
        }
    };
};

Wonderfl.Userpage = new function() {
    var delete_confirm = 'going to remove this code from your favorites, are you sure?';
    var is_favorite_page = false;
    return {
        has_listener : [],
        load : function() {
            // only for something like /user/mash
            if ( ! location.pathname.match('/user/[0-9a-z_]*','i') ) { return; }
            if ( location.pathname.match('/user/[0-9a-z_]*/favorites','i') ) {
                is_favorite_page = true;
            }

            // delete button
            getElementsByIdPrefix('delete_code_button_').each( function(deleter) {
                deleter.observe('click', function(ev) {
                    ev.stop();
                    if ( ! confirm(delete_confirm) ) { return; }
                    var uid = this.extract_code_uid(deleter);
                    var uri = is_favorite_page ? '/api/code/favorite/destroy' : '/api/code/destroy';

                    new Ajax.Request( uri ,{
                        method : 'post',
                        parameters : {
                            code_uid : uid
                        },
                        onComplete : function() {
                            $('code_'+uid).remove();
                        }.bind(this)
                    });
                }.bindAsEventListener(this) );
            }.bind(this) );

            // follow button
            var follow_button = $('follow_button');
            if ( follow_button && ! follow_button.onclick ) {
                follow_button.observe('click', function(ev) {
                    ev.stop();
                    new Ajax.Request( '/api/user/follow', {
                        method : 'post',
                        parameters : {
                            target : this.extract_username()
                        },
                        onComplete : function( o ) {
                            var json = o.responseJSON;
                            if ( json.error ) {
                                console.log("[error]follow",json);
                            }
                            else {
                                follow_button.href = '/mypage';
                                follow_button.innerHTML = l('フォロー済');
                                follow_button.stopObserving();
                            }
                        }
                    });
                }.bindAsEventListener(this));
            }

            // follow解除ボタン
            var unfollow_button = $('unfollow_button');
            if ( unfollow_button ) {
                unfollow_button.observe('click', function(ev) {
                    ev.stop();
                    if ( ! confirm( l('このユーザーをフォロー解除します\nよろしいですか？') ) ) { return; }
                    new Ajax.Request( '/api/user/follow/destroy', {
                        method : 'post',
                        parameters : {
                            target : this.extract_username()
                        },
                        onComplete : function( o ) {
                            var json = o.responseJSON;
                            if ( json.error ) {
                                console.log("[error]unfollow",json);
                            }
                            else {
                                location.reload();
                            }
                        }
                    });
                }.bindAsEventListener(this));
            }

            // edit favorite comment/tag
            getElementsByIdPrefix('favorite_edit_button_').each( function(edit_button) {
                edit_button.observe('click', function(ev) {
                    ev.stop();
                    var index = ev.element().id.substr(21);
                    var form = $('favorite_editor_'+index);
                    form.show();
                    form.comment.focus();
                    form.disabled = false;
                    form.submit.disabled = false;
                    $('favorite_comment_container_'+index).hide();
                    
                    if ( this.has_listener[index] ) { return; }
                    this.has_listener[index] = true;

                    form.observe('submit', function(ev, form, index) {
                        ev.stop();
                        form.disabled = true;
                        form.submit.disabled = true;
                        new Ajax.Request( '/api/code/favorite', {
                            method : 'post',
                            parameters : form.serialize(true),
                            onComplete : function( form, index, o ) {
                                var json = o.responseJSON;
                                if ( json.error ) {
                                    console.log("[error]edit favorite",json);
                                }
                                else {
                                    form.disabled = false;
                                    form.submit.disabled = false;
                                    form.hide();
                                    $('favorite_comment_container_'+index).show();
                                    $('favorite_comment_'+index).update( json.result.html );
                                }
                            }.bind( this, form, index)
                        });
                    }.bindAsEventListener(this, form, index ));
                }.bindAsEventListener(this) );
            }.bind(this) );

            // 高さ揃え
            var heightAlignTargets = $$(".groupLeveled > *");
            var maxHeight = heightAlignTargets.max(function(arg) {
                return arg.offsetHeight;
            });
            heightAlignTargets.each(function (arg) {
                arg.style.height = maxHeight + "px";
            });
        },
        extract_code_uid : function( anchor ) {
            return anchor.className.substr( anchor.className.indexOf('code_') + 5 );
        },
        extract_username : function() {
            // "/user/mash/*" -> mash
            var match = location.pathname.match('/user/([^/]+)');
            return match[1];
        }
    };
};

Wonderfl.Codepage = new function() {
    var diff_mode = false;
    var diff_container;
    var diff_controller;
    var tags_loaded = false;
    return {
        form : null,
        swf_id : "externalFlashViewer",
        stop_button   : null,
        reload_button : null,
        load : function() {
            // only for something like /code/******
            if ( ! location.pathname.match('/c/[0-9a-zA-Z]+/?$') &&
                 ! location.pathname.match('/c/[0-9a-zA-Z]+/read$') &&
                 ! location.pathname.match('^/blogparts/[0-9a-zA-Z]+/?$') &&
                 ! location.pathname.match('^/event/jam/session') ) { return; }
            if (location.pathname.match('^/blogparts/[0-9a-zA-Z]+/?$') && !swfobject.getFlashPlayerVersion().major) {
                var event_url = 'http://wonderfl.net/event/invisibleman';
                var icon = ('0'+(((Math.random() * 20)|0) + 1)).match(/\d\d$/).pop();
                var image_url = event_url + 'preview/';
                image_url += (((navigator.language || navigator.browserLanguage)+'').match(/ja/) ? 'ja' : 'en') + '/';
                $('wrapper').innerHTML = '<a href="'+event_url+'?blogparts" target="_blank" style="border:none;margin:0;padding:0;"><img src="'+image_url+'bp_'+icon+'.png" width="465" height="465" style="margin-top:25px" /></a>';
                return;
            };

            // init viewer
            this.init_viewer();
            this.add_button_listeners(); // for stop,reload

            var favorite_button = $('favorite_button');
            var form = this.form = $('add_favorite_form');
            var container = $('boxAddFav');
            if ( favorite_button && form ) {
                var listener = function(ev) {
                    ev.stop();
                    container.style.display = 'block';
                    this.load_tags( code_uid ); // code_uid from global
                    form.comment.focus();
                    form.disabled = false;
                    $('add_favorite_submit').disabled = false;
                }.bindAsEventListener(this);
                favorite_button.observe('click', listener);

                var jump_to_favorite = $('jump_to_favorite_button');
                if ( jump_to_favorite ) {
                    jump_to_favorite.observe('click', listener);
                }

                $('reset_favorite').observe('click', function(ev) {
                    container.style.display = 'none';
                });

                form.observe('submit', function(ev) {
                    ev.stop();
                    form.disabled = true;
                    $('add_favorite_submit').disabled = true;
                    new Ajax.Request( '/api/code/favorite', {
                        method : 'post',
                        parameters : {
                            code_uid : code_uid,
                            comment  : form.comment.value,
                            tags     : form.tags.value
                        },
                        onComplete : function(o) {
                            var json = o.responseJSON;
                            if ( json.error ) {
                                console.log("[error]favorite",json);
                            }
                            else {
                                favorite_button.update(new Element("img", {
                                    src: "/img/common/btn/btn_code_add_fav_d.png?t=1",
                                    alt: l('お気に入りに追加済'), 
                                    width: 140,
                                    height: 50
                                }));
                                container.style.display = 'none';
                            }
                        }.bind(this)
                    });
                }.bindAsEventListener(this));
            }

            var diff_close_button = $("diff_close_button");
            if ( diff_close_button ) {
                diff_close_button.observe('click', function(ev) {
                    this.on_diff_close();
                    ev.stop();
                }.bindAsEventListener(this));
            }

            // talk
            this.init_talk();
        },
        reload_swf : function() {
            this.play();
        },
        play : function() {
            // code_uid from global
            Wonderfl.Renderer.render( Wonderfl.Compiler.build_swffilepath(true) );
            if (Wonderfl.Codepage.play_button) {
                Wonderfl.Codepage.play_button.hide();
            }
            if ( Wonderfl.Codepage.stop_button ) {
                Wonderfl.Codepage.stop_button  .show();
            }
            if ( Wonderfl.Codepage.reload_button ) {
                Wonderfl.Codepage.reload_button.show();
            }
        },
        add_button_listeners : function() {
            this.play_button   = $('btnPlay');
            this.stop_button   = $('btnStop');
            this.reload_button = $('btnReload');
            if (this.play_button) {
                this.play_button.observe('click', function(ev) {
                    this.play();
                }.bindAsEventListener(this));
            }
            if ( this.stop_button ) {
                this.stop_button.observe('click', function(ev) {
                    Wonderfl.Renderer.show_play_button();
                    this.play_button  .show();
                    this.stop_button  .hide();
                    this.reload_button.hide();
                    ev.stop();
                }.bindAsEventListener(this) );
            }
            if ( this.reload_button ) {
                this.reload_button.observe('click', function(ev) {
                    this.play();
                    ev.stop();
                }.bindAsEventListener(this) );
            }
        },
        init_viewer : function() {
            // setup flash viewer
            if ( ! $(this.swf_id) ) {
                return;
            }

            // all from global
            var flashvars = {
                server: ((typeof(compiler_server)!="undefined") ? compiler_server : ''),
                port:   ((typeof(compiler_port)!="undefined")   ? compiler_port : ''),
                room:   code_uid,
                ticket: ((typeof(ticket)!="undefined")          ? ticket : ''),
                big_viewer: (location.pathname.match('/read$') ? 1 : 0)
            };
            if ( typeof(viewer) == "object" ) {
                flashvars["viewer.displayName"] = viewer.displayName;
                flashvars["viewer.iconURL"]     = viewer.iconURL;
            }
            if ( typeof(is_login) == "string" ) {
                flashvars["is_login"] = is_login;
            }

            var params    = {
                quality           : "high",
                allowfullscreen   : "true",
                allowscriptaccess : "always",
                wmode             : "transparent"
            };

            var attributes = {
                align : "middle",
                id    : "externalFlashViewer",
                name  : "externalFlashViewer"
            };

            // viewer_swf from global
            swfobject.embedSWF( viewer_swf, this.swf_id, "100%", "100%", "11.0.0", "/swf/expressInstall.swf", flashvars, params, attributes );
        },
        get_initial_code : function() {
            // called from WonderflViewer.swf
            return $('raw_as3').value.replace(/\r\n/g, '\n'); // replace for IE8;
        },
        get_stage_size : function() {
            // called from WonderflViewer.swf
            // this.swf_idだと最初に呼ばれた時にheightが0になってる時があるから
            var dimensions = $(this.swf_id).getDimensions();
            return [ dimensions.width, dimensions.height ];
        },
        scale_down : function() {
            Wonderfl.Compiler.scale_down();
        },
        load_tags : function( uid ) {
            if ( ! tags_loaded ) {
                tags_loaded = true;
                new Ajax.Request( '/api/code/tag', {
                    method : 'get',
                    parameters : {
                        code_uid : uid
                    },
                    onComplete : function(o) {
                        var result = o.responseJSON.result;
                        var els = [];
                        ["my_tags", "other_users_tags", "other_tags"].each(function(tag_dt) {
                            var tags = result[tag_dt];
                            if (tags.length > 0) {
                                var container = $(tag_dt + "_container").update('');
                                tags.each(function(tag) {
                                    var el = new Element('li').insert(new Element('a', {href: '#'}).update(tag));
                                    container.appendChild(el);
                                    els.push( el );
                                }.bind(this));
                            } else {
                                $(tag_dt + "_container").remove();
                            }
                        }.bind(this));

                        new Marshmallow.Form.SmartCandidates({ candidates: els, target: this.form.tags });

                    }.bind(this)
                });
            }
        },
        client_height : function() {
            return Math.max( (window.innerHeight||0),
                             (document.body.clientHeight||0),
                             (document.body.offsetHeight||0),
                             (document.body.scrollHeight||0),
                             (document.documentElement.clientHeight||0),
                             (document.documentElement.scrollHeight||0)
                           );
        },
        on_diff_click : function( uid1, uid2 ) {
            if ( diff_mode === true ) { return; }

            new Ajax.Request( '/api/code/diff', {
                method : 'get',
                parameters : {
                    code_uid1 : uid1,
                    code_uid2 : uid2,
                    format: 'html'
                },
                onComplete : function(o) {
                    var json = o.responseJSON;
                    if ( json.error ) {
                        console.log("[error]diff",json);
                        return;
                    }
                    diff_container = $('diff_container');
                    diff_controller = $('diff_controller');
                    if ( ! diff_container || ! diff_controller ) { return; }

                    diff_controller.style.display = 'block';

                    diff_container.innerHTML = json.html;
                    diff_container.style.display = 'block';
                    diff_container.style.height  = (this.client_height() || 0) + 'px';

                    this.swf = $("externalFlashContent");
                    if ( this.swf ) {
                        this.swf.style.visibility = 'hidden';
                    }
                    window.scrollTo(0,0);
                }.bind(this)
            });
        },
        on_diff_close : function() {
            diff_mode = false;
            diff_container.style.display = 'none';
            diff_controller.style.display = 'none';
            if ( this.swf ) {
                this.swf.style.visibility = '';
            }
        },
        init_talk : function() {
            var textarea = $('code_talk_textarea');
            var form     = $('talk_form');
            if ( ! textarea || ! form ) { return; }

            new Marshmallow.Form.InputPrompt({
                form: form,
                input: textarea,
                default_text: 'Got a question? or leave a message to the creator?'
            });
            form.observe('submit', function(ev) {
                ev.stop();
                new Ajax.Request( form.action, {
                    method     : 'post',
                    parameters : form.serialize(true),
                    onComplete : function(o) {
                        var json = o.responseJSON;
                        if (json.result == "ok") {
                            $('talk_container').innerHTML += json.html;
                            textarea.value = '';
                        }
                        else {
                            var message = '';
                            for ( var key in json.error ) {
                                message += json.error[key].join(' ');
                            }
                            $('code_talk_note').innerHTML = message;
                            form.addClassName('statusNG');
                        }
                    }.bind(this)
                });
            }.bindAsEventListener(this));
        },
        remove_talk : function( code, uid ) {
            var container = $('talk_container');
            if ( ! container ) { return; }

            if ( ! confirm('really delete?') ) { return; }

            container.removeChild( $('talk_unit_' + uid) );

            new Ajax.Request( '/api/code/talk/remove', {
                method: 'post',
                parameters: { uid: uid, code: code },
                onComplete: function(o) {
                }
            }); 
            return false;
        },
        download_swf : function() {
            // _lightbox from global
            _lightbox.startHTML( $('swf_download_confirmation').innerHTML, 400 );
        }
    };
};

Wonderfl.Live = new function() {
    return {
        elapsed_time_spans : null,
        timer : null,
        load : function() {
            // only for something like /live
            if ( ! location.pathname.match('^/live/?','i') ) { return; }
            this.elapsed_time_spans = $$('span.elapsed_time');
            this.start_timer();
            this.elapsed_time_spans.each( function(el) { el.style.visibility = 'visible'; } );
        },
        start_timer : function() {
            if ( this.timer ) {
                clearInterval( this.timer );
                this.timer = null;
            }
            this.timer = setInterval( this.on_timer.bind(this), 1000 );
            this.on_timer();
        },
        on_timer : function() {
            var count = this.elapsed_time_spans.length;
            for ( var i=0; i<count; i++ ) {
                var span = this.elapsed_time_spans[ i ];
                var time = span.time || parseInt( span.innerHTML );

                time++;

                span.time      = time;
                span.innerHTML = this.render_time( time );
            }
        },
        render_time : function( seconds ) {
            var hours   = parseInt( seconds / 3600 );
            var minutes = parseInt( (seconds % 3600) / 60 );
            seconds = seconds % 60;
            return ("00" + hours).substr(-2,2) + ':' + ("00" + minutes).substr(-2,2) + ':' + ("00" + seconds).substr(-2,2);
        }
    };
};


document.observe("dom:loaded", Wonderfl.Compiler.load.bind(Wonderfl.Compiler));
Wonderfl.Account.init();
Wonderfl.APIKeys.init();
document.observe("dom:loaded", Wonderfl.Account.load.bind(Wonderfl.Account));
document.observe("dom:loaded", Wonderfl.Index.load.bind(Wonderfl.Index));
document.observe("dom:loaded", Wonderfl.Userpage.load.bind(Wonderfl.Userpage));
document.observe("dom:loaded", Wonderfl.Codepage.load.bind(Wonderfl.Codepage));
document.observe("dom:loaded", Wonderfl.Live.load.bind(Wonderfl.Live));
