
/* 2008 Daichi Hiroki <hirokidaichi@gmail.com>
 * html-template-core.js is freely distributable under the terms of MIT-style license.
 * ( latest infomation :https://github.com/hirokidaichi/html-template )
/*-----------------------------------------------------------------------*/
var util = {};
util.defineClass = function(obj,superClass){
    var klass = function Klass(){
        this.initialize.apply(this,arguments);
    };
    
    if(superClass) klass.prototype = new superClass;
    for(var prop in obj ){
        if( !obj.hasOwnProperty(prop) )
            continue;
        klass.prototype[prop] = obj[prop];
    }
    if( !klass.prototype.initialize )
        klass.prototype.initalize = function(){};
    return klass;
};
util.merge = function(origin,target){
    for(var prop in target ){
        if( !target.hasOwnProperty(prop) )
            continue;
        origin[prop] = target[prop];
    }
};
util.k = function(k){return k};
util.emptyFunction = function(){};
util.listToArray = function(list){
    return Array.prototype.slice.call(list);
};
util.curry = function() {
    var args = listToArray(arguments);
    var f    = args.shift();
    return function() {
      return f.apply(this, args.concat(util.listToArray(arguments)));
    }
};

util.merge(util,{
    isArray: function(object) {
        return object != null && typeof object == "object" &&
          'splice' in object && 'join' in object;
    },
    isFunction: function(object) {
        return typeof object == "function";
    },
    isString: function(object) {
        return typeof object == "string";
    },
    isNumber: function(object) {
        return typeof object == "number";
    },
    isUndefined: function(object) {
        return typeof object == "undefined";
    }
});
util.createRegexMatcher = function(escapeChar,expArray){
    function _escape( regText){
        return (regText + '').replace(new RegExp(escapeChar,'g'), "\\");
    }
    var count = 0;
    var regValues = expArray.reduce(function(val,e,i){
        if(util.isString(e)){
            val.text.push(e);
        }else{
            //val.mapping.push(e.map);
            if(!val.mapping[e.map]){
                val.mapping[e.map] = [];
            }
            val.mapping[e.map].push(++count);
        }
        return val;
    },{mapping:{'fullText':[0]},text:[]});
    var reg = undefined;
    regValues.text = _escape(regValues.text.join(''));

    return function matcher(matchingText){
        if(!reg){
            reg = new RegExp(regValues.text);
        }
        var results = (matchingText || '').match(reg);
        if(results){
            var ret = {};
            var prop = 0,i = 0,map = regValues.mapping;
            for(prop in map){
                var list   = map[prop];
                var length = list.length;
                for(i = 0 ;i<length ;i++){
                    if(results[list[i]]){
                        ret[prop] = results[list[i]];
                        break;
                    }
                }
            }
            return ret;

        }else{
            return undefined;
        }
    };

};


var CHUNK_REGEXP_ATTRIBUTE = util.createRegexMatcher('%',[
    "<",
    "(%/)?",{map:'close'},
    "TMPL_",
    "(VAR|LOOP|IF|ELSE|ELSIF|UNLESS|INCLUDE)",{map:'tag_name'},
    "%s*",
    "(?:",
        "(?:DEFAULT)=",
        "(?:",
            "'([^'>]*)'|",{map:'default'},
            '"([^">]*)"|',{map:'default'},
            "([^%s=>]*)" ,{map:'default'},
        ")",
    ")?",
    "%s*",
    "(?:",
        "(?:ESCAPE)=",
        "(?:",
            "(JS|URL|HTML|0|1|NONE)",{map:'escape'},
        ")",
    ")?",
    "%s*",
    "(?:",
        "(?:DEFAULT)=",
        "(?:",
            "'([^'>]*)'|",{map:'default'},
            '"([^">]*)"|',{map:'default'},
            "([^%s=>]*)" ,{map:'default'},
        ")",
    ")?",
    "%s*",
    /*
        NAME or EXPR
    */
    "(?:",
        "(NAME|EXPR)=",{map:'attribute_name'},
        "(?:",
            "'([^'>]*)'|",{map:'attribute_value'},
            '"([^">]*)"|',{map:'attribute_value'},
            "([^%s=>]*)" ,{map:'attribute_value'},
        ")",
    ")?",
    /*
        DEFAULT or ESCAPE
    */
    '%s*',
    "(?:",
        "(?:DEFAULT)=",
        "(?:",
            "'([^'>]*)'|",{map:'default'},
            '"([^">]*)"|',{map:'default'},
            "([^%s=>]*)" ,{map:'default'},
        ")",
    ")?",
    "%s*",
    "(?:",
        "(?:ESCAPE)=",
        "(?:",
            "(JS|URL|HTML|0|1|NONE)",{map:'escape'},
        ")",
    ")?",
    "%s*",
    "(?:",
        "(?:DEFAULT)=",
        "(?:",
            "'([^'>]*)'|",{map:'default'},
            '"([^">]*)"|',{map:'default'},
            "([^%s=>]*)" ,{map:'default'},
        ")",
    ")?",
    "%s*",
    ">"
]);

var element = {};
element.Base = util.defineClass({
    initialize: function(option) {
        this.mergeOption(option);
    },
    mergeOption : function(option){
        util.merge(this,option);
        this['closeTag'] =(this['closeTag'])? true: false;
    },
    isParent : util.emptyFunction,
    execute  : util.emptyFunction,
    isClose  : function() {
        return this['closeTag'] ? true: false;
    },

    getCode: function(e) {
        return "void(0);";
    },
    toString: function() {
        return [
            '<' ,
            ((this.closeTag) ? '/': '') ,
            this.type ,
            ((this.hasName) ? ' NAME=': '') ,
            ((this.name) ? this.name: '') ,
            '>'
        ].join('');
    },
    // HTML::Template::Pro shigeki morimoto's extension
    _pathLike: function(attribute , matched){
        var pos = (matched == '/')?'0':'$_C.length -'+(matched.split('..').length-1);
        return  [
            "(($_C["+pos+"]['"        ,
            attribute ,
            "']) ? $_C["+pos+"]['"    ,
            attribute ,
            "'] : undefined )"
        ].join('');

    },
    getParam: function() {
        var ret = "";
        if (this.attributes['name']) {
            var matched = this.attributes['name'].match(/^(\/|(?:\.\.\/)+)(\w+)/);
            if(matched){
                return this._pathLike(matched[2],matched[1]);
            }
            ret =  [
                "(($_T['"            ,
                    this.attributes['name'] ,
                "']) ? $_T['"        ,
                    this.attributes['name'] ,
                "'] : ",
                    JSON.stringify(this.attributes['default'])  || 'undefined',
                " )"
            ].join('');
        }
        if (this.attributes['expr']) {
            var operators = {
                'gt' :'>',
                'lt' :'<',
                'eq' :'==',
                'ne' :'!=',
                'ge' :'>=',
                'le' :'<='
            };
            var replaced = this.attributes['expr'].replace(/{(\/|(?:\.\.\/)+)(\w+)}/g,function(full,matched,param){
                return [
                     '$_C[',
                     (matched == '/')?'0':'$_C.length -'+(matched.split('..').length-1),
                     ']["',param,'"]'
                ].join('');
            }).replace(/\s+(gt|lt|eq|ne|ge|le|cmp)\s+/g,function(full,match){
                return " "+operators[match]+" ";
            });
            ret = [
                "(function(){",
                "    with($_F){",
                "        with($_T){",
                "            return (", replaced ,');',
                "}}})()"
            ].join('');
        }
        if(this.attributes['escape']){
            var escape = {
                NONE: 'NONE',
                0   : 'NONE',
                1   : 'HTML',
                HTML: 'HTML',
                JS  : 'JS',
                URL : 'URL'
            }[this.attributes['escape']];
            ret = [
                '$_F.__escape'+escape+'(',
                ret,
                ')'
            ].join('');
        }
        return ret;
    }
});

var cache = {
    STRING_FRAGMENT : []
};


util.merge( element , {
    ROOTElement: util.defineClass({
        type: 'root',
        getCode: function() {
            if (this.closeTag) {
                return 'return $_R.join("");';
            } else {
                return [
                    'var $_R  = [];',
                    'var $_C  = [param];',
                    'var $_F  = funcs||{};',
                    'var $_T  = param||{};',
                    'var $_S  = cache.STRING_FRAGMENT;',
                ].join('');
            }
        }
    },element.Base),

    LOOPElement: util.defineClass({
        type: 'loop',
        initialize:function(option){
            this.mergeOption(option);
        },
        getLoopId : function(){
            if( this._ID ) {
                return this._ID;
            }
            if( !element.LOOPElement.instanceId ){
                element.LOOPElement.instanceId = 0;
            }
            var id = element.LOOPElement.instanceId++;
            this._ID = '$'+id.toString(16);
            return this._ID;
        },
        getCode: function() {
            if (this.closeTag) {
                return ['}','$_T = $_C.pop();'].join('');
            } else {
                var id = this.getLoopId();
                return [
                'var $_L_'+id+' =' + this.getParam() + '|| [];',
                'var $_LL_'+id+' = $_L_'+id+'.length;',
                '$_C.push($_T);',
                'for(var i_'+id+'=0;i_'+id+'<$_LL_'+id+';i_'+id+'++){',
                '   $_T = (typeof $_L_'+id+'[i_'+id+'] == "object")?',
                '                $_L_'+id+'[i_'+id+'] : {};',
                "$_T['__first__'] = (i_"+id+" == 0) ? true: false;",
                "$_T['__counter__'] = i_"+id+"+1;",
                "$_T['__odd__']   = ((i_"+id+"+1)% 2) ? true: false;",
                "$_T['__last__']  = (i_"+id+" == ($_LL_"+id+" - 1)) ? true: false;",
                "$_T['__inner__'] = ($_T['__first__']||$_T['__last__'])?false:true;"
                ].join('');
            }
        }
    },element.Base),

    VARElement: util.defineClass({
        type: 'var',
        getCode: function() {
            if (this.closeTag) {
                throw(new Error('HTML.Template ParseError'));
            } else {
                return '$_R.push(' + this.getParam() + ');';
            }
        }
    },element.Base),

    IFElement: util.defineClass({
        type: 'if',
        getCondition: function(param) {
            return "!!" + this.getParam(param);
        },
        getCode: function() {
            if (this.closeTag) {
                return '}';
            } else {
                return 'if(' + this.getCondition() + '){';
            }
        }
    },element.Base),

    ELSEElement: util.defineClass( {
        type: 'else',
        getCode: function() {
            if (this.closeTag) {
                throw(new Error('HTML.Template ParseError'));
            } else {
                return '}else{';
            }
        }
    },element.Base),

    INCLUDEElement: util.defineClass({
        type: 'include',
        getCode: function() {
            if (this.closeTag) {
                throw(new Error('HTML.Template ParseError'));
            } else {
                var name = '"'+(this.attributes['name'])+'"';
                return [
                    'if(HTML.Template.Cache['+name+']){',
                    '   var _tmpl = new HTML.Template('+name+');',
                    '   _tmpl.registerFunction(this._funcs );',
                    '   _tmpl.param($_T);',
                    '   $_R.push(_tmpl.output());',
                    '}'
                ].join('\n');
            }
        }
    },element.Base),

    TEXTElement: util.defineClass({
        type: 'text',
        closeTag: false,
        initialize : function(option){this.value = option;},
        getCode: function() {
            if (this.closeTag) {
                throw(new Error('HTML.Template ParseError'));
            } else {
                cache.STRING_FRAGMENT.push(this.value);
                return '$_R.push($_S['+(cache.STRING_FRAGMENT.length-1)+']);';
            }
        }
    },element.Base)
});

element.ELSIFElement = util.defineClass({
    type: 'elsif',
    getCode: function() {
        if (this.closeTag) {
            throw(new Error('HTML.Template ParseError'));
        } else {
            return '}else if(' + this.getCondition() + '){';
        }
    }
},element.IFElement);

element.UNLESSElement = util.defineClass({
    type: 'unless',
    getCondition: function(param) {
        return "!" + this.getParam(param);
    }
},element.IFElement);


element.createElement = function(type, option) {
    return new element[type + 'Element'](option);
};

var parseHTMLTemplate = function(source) {
    var chunks = [];
    var createElement = element.createElement;
    var root  = createElement('ROOT', {
        closeTag: false
    });
    var matcher = CHUNK_REGEXP_ATTRIBUTE;
    chunks.push(root);

    while (source.length > 0) {
        var results = matcher(source);
        //最後までマッチしなかった
        if (!results) {
            chunks.push(createElement('TEXT', source));
            source = '';
            break;
        }
        var index = 0;
        var fullText = results.fullText;
        if ((index = source.indexOf(fullText)) > 0) {
            var text = source.slice(0, index);
            chunks.push(createElement('TEXT', text));
            source = source.slice(index);
        };
        var attr,name,value;
        if ( results.attribute_name ) {
            name  = results.attribute_name.toLowerCase();
            value = results.attribute_value;
            attr  = {};
            attr[name]      = value;
            attr['default'] = results['default'];
            attr['escape']  = results['escape'];
        } else {
            attr = undefined;
        }
        chunks.push(createElement(results.tag_name, {
            'attributes': attr,
            'closeTag'  : results.close,
            'parent'    : this
        }));
        source = source.slice(fullText.length);
    };
    chunks.push(createElement('ROOT', {
        closeTag: true
    }));
    return chunks;
};

var exports = {};
exports.getFunctionText = function(chunksOrSource){
    var chunks = util.isString(chunksOrSource) ? parseHTMLTemplate( chunksOrSource ) : chunksOrSource;
    var codes = [];
    for(var i=0,l=chunks.length;i<l;i++){codes.push(chunks[i].getCode());};
    return codes.join('\n');
};

exports.compileFunctionText = function(functionText){
    return util.curry(new Function('cache','param','funcs',functionText),cache);
};
