/**
 * SWFFormFix v2.1.0: SWF ExternalInterface() Form Fix - http://http://www.teratechnologies.net/stevekamerman/
 *
 * SWFFormFix is (c) 2007 Steve Kamerman and is released under the MIT License:
 * http://www.opensource.org/licenses/mit-license.php
 *
 * Project sponsored by Tera Technologies - http://www.teratechnologies.net/
 */
////////////////////////////////////////////////////
////////////  Configurable options  ////////////////
////////////////////////////////////////////////////
var EnableFullAuto	= false; // set this to true and all of your flash objects will be fixed automatically
var SWFFormFixDebug = false; // set this to true to be alerted whenever a flash object is found and fixed
var NotLoadedWarning = false; // set this to true to alert the users when they try to access a function from
							 // the ExternalInterface() that isn't loaded yet
var NotLoadedMsg = "Please wait for the page to load..."; // this is the warning they will see
////////////////////////////////////////////////////
//////////  END Configurable options  //////////////
////////////////////////////////////////////////////
/**
 * Usage:
 * ------------------------------------------------------------
 * There are three ways to use SWFFormFix, FULL AUTO, Auto and Manual mode.
 * To use either method you need to include this file in the 
 * HEAD section of your page like this: 

<script src="swfformfix.js" type="text/javascript"></script>

 * 
 * NOTE: If you want Javascript to call Flash, you need to make
 * a dummy object like follows:
 
window["myFlashObject"] = new Object();

 * Put this line directly above your call to SWFObject().
 * Replace "myFlashObject" with the ID of your object (the 2nd
 * parameter you give to SWFObject() ).  This will prevent your
 * page from dieing with an error like "myFlashObject is undefined".
 * 
 * --> FULL AUTO Mode:
 * This will attempt to find every Flash Movie that you have on
 * the page and apply the fix to each of them as the page loads.
 * It will poll the page for all the objects and determine if it
 * needs to apply the fix to them every 100ms until the page is
 * completely loaded.  All you need to do to use this mode is
 * include the script in the head of your document and set the
 * "EnableFullAuto" directive to true at the top of the script.
 *
 * --> Auto Mode:
 * This will attempt to find every Flash Movie that you have on
 * the page and apply the fix to each of them.  To use auto mode
 * put the following code before the </body> tag. More specifically
 * it needs to be AFTER your last Flash object.

<script type="text/javascript">
// <![CDATA[
	SWFFormFixAuto();
// ]]>
</script>

 * 
 * --> Manual Mode:
 * This lets you fix just a single Flash object if you don't want
 * the auto mode to try to fix every Flash object on the page.
 * This mode is faster than the auto mode and may work better in
 * some situations.  To use manual mode put the following code
 * after the Flash object you want to fix, where "myFlashObject"
 * is the ID of the Flash Object:

Example for normal EMBED style:

<object classid="clsid:d27cdb6e-ae6d-11cf-96b8-444553540000" width="200" height="100" id="myFlashObject" align="middle">
<param name="movie" value="myMovie.swf" />
<param name="quality" value="high" />
<embed src="myMovie.swf" quality="high" width="200" height="100" name="myFlashObject" type="application/x-shockwave-flash" />
</object>

<script type="text/javascript">
// <![CDATA[
SWFFormFix("myMovieObjectName");
// ]]>
</script>

Example for SWFObject style:

<div id="flashcontent" style="width:200px;height:100px;">This is replaced by the Flash movie.</div>
<script type="text/javascript">
// <![CDATA[
// Please note that the ID that you need to use for SWFFormFix() is the second argument in SWFObject().
var so = new SWFObject("myMovie.swf", "myFlashObject","200", "100", "6.0.0", "#ffffff");
so.addParam("quality", "high");
so.write("flashcontent");
SWFFormFix("myFlashObject");
// ]]>
</script>

 * 
 * Changelog:
 * ------------------------------------------------------------
 * v2.1
 *   Fixed IE cache bug that prevents JS -> Flash after refresh.  Now SWFFormFix
 *   rebuilds all the ExternalInterface() methods that were inadvertently destroyed.
 * v2.0
 *   Added FULL AUTO mode - just enable it below and include the script!
 *   Special thanks to Geoff Stearns from deconcept and onDOMload by Aaron Barker
 * 
 * v1.0
 *   Added the SWFFormFixAuto() function, very well optimized and fast.
 * 
 * v0.2
 *   Changed helper element from <input> element to hidden <div> element
 *
 * v0.1
 *   Initial release.
 */

finished = false; // this is set to true when the body's onload is called, to stop the script
timeout = 10; // seconds to wait before giving up
starttime = new Date().getTime();
flashObjectList = Array();
fixedList = Array();
makeFuncArr = Array();
SWFFormFixAuto2 = function(){
//alert("running...");
	if(navigator.appName.toLowerCase() != "microsoft internet explorer")return true;
	var flashObjectList = document.getElementsByTagName("object");
	for(var i=0;i<flashObjectList.length;i++){
		var obj = flashObjectList[i];
		// here's all the objects on the page, now lets find the flash objects
		if(obj.getAttribute('classid') == "clsid:D27CDB6E-AE6D-11cf-96B8-444553540000"){
			var id = obj.getAttribute('id');
			var alreadyfixed = false;
			for(var c=0;c<fixedList.length;c++){if(fixedList[i] == id)alreadyfixed=true;}
			// this is a flash movie, apply the fix (unless it's already been fixed)
			if(!alreadyfixed){
				var debugtxt = '';
				for(var b in window[id]){
					// ExternalInterface() tried to add some functions to the incorrect object
					if(typeof(window[id][b])=="function"){
						// this function will need to be rebuilt when the page is done loading.
						makeFuncArr.push(Array(obj,b));
						obj[b] = function(){
							if(NotLoadedWarning)alert(NotLoadedMsg);
							return("");
						}
/*
 * it seems like this would work to copy the function, but it doesn't:
 *
 * eval('obj[b]='+window[id][b].toString());
 * 
 * This is the actual function that we're trying to copy:

function () { 
  return eval(instance.CallFunction("<invoke name=\""+name+"\" returntype=\"javascript\">" + __flash__argumentsToXML(arguments,0) + "</invoke>"));
}

 * it will fail if you copy it to the new object though because "instance" and "name" are undefined
 * Here's how to see the actual function def: document.getElementById("txt_debug").value=window[id][b];
 */
					}
				}
				window[id]=obj;
				if(SWFFormFixDebug)alert("Fixed: "+id);
			}
		}
	}
	if(!finished){
		setTimeout("SWFFormFixAuto2()", 100);
	}else{
		for(var i=0;i<makeFuncArr.length;i++){
			// this is executed after the page is loaded - it rebuilds the custom
			// ExternalInterface() functions
			SWFFormFix_rebuildExtFunc(makeFuncArr[i][0],makeFuncArr[i][1]);
		}
	}
	return true;
}
SWFFormFix_rebuildExtFunc = function(obj,functionName){
	eval('obj[functionName] = function(){return eval(this.CallFunction("<invoke name=\\"'+functionName+'\\" returntype=\\"javascript\\">" + __flash__argumentsToXML(arguments,0) + "</invoke>"));}');
	if(SWFFormFixDebug)alert("Rebuilt ExternalInterface() function: "+functionName);
}
SWFFormFixOnloadAppend = function() {
	var oldonload = window.onload;
	if (typeof window.onload != 'function') {
		window.onload = function(){
			finished=true;
		}
	} else {
		window.onload = function() {
			oldonload();
			finished=true;
		}
	}
}
SWFFormFixAuto = function(){
	if(navigator.appName.toLowerCase() != "microsoft internet explorer")return true;
	var objects = document.getElementsByTagName("object");
	if(objects.length == 0) return true;
	for(i=0;i<objects.length;i++){
		// here's all the objects on the page, now lets find the flash objects
		if(objects[i].classid == "clsid:D27CDB6E-AE6D-11cf-96B8-444553540000"){
			// this is a flash movie, apply the fix
			window[objects[i].id] = objects[i];
		}
	}
	var out = "";
	return true;
}
SWFFormFix = function(swfname){
	if(navigator.appName.toLowerCase() != "microsoft internet explorer")return false;
	var testnodename = "SWFFormFixTESTER";
	document.write('<div id="'+testnodename+'" onclick="SWFFormFixCallback(this,\''+swfname+'\');return false;" style="display:none">&nbsp;</div>');
	document.getElementById(testnodename).onclick();
}
SWFFormFixCallback = function (obj,swfname){
	var path = document;
	var error = false;
	var testnode = obj;
	while(obj = obj.parentNode){
		if(obj.nodeName.toLowerCase() == "form"){
			if(obj.name != undefined && obj.name != null && obj.name.length > 0){
				path = path.forms[obj.name];
			}else{
				//alert("Error: one of your forms does not have a name!");
				error = true;
			}
		}
	}
	testnode.parentNode.removeChild(testnode);
	if(error) return false;
	window[swfname]=path[swfname];
	return true;
}
if(EnableFullAuto){
	SWFFormFixAuto2();
	SWFFormFixOnloadAppend();
}