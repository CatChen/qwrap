/*
	Copyright (c) 2009, Baidu Inc. All rights reserved.
	version: $version$ $release$ released
	author: yingjiakuan@baidu.com
*/


/**
 * @class Selector Css Selector相关的几个方法
 * @singleton
 * @namespace QW
 */
(function(){
var trim=QW.StringH.trim,
	encode4Js=QW.StringH.encode4Js;

var Selector={
	/**
	 * @property {int} queryStamp 最后一次查询的时间戳，扩展伪类时可能会用到，以提速
	 */
	queryStamp:0,
	/**
	 * @property {Json} _operators selector属性运算符
	 */
	_operators:{	//以下表达式，aa表示attr值，vv表示比较的值
		'': 'aa',//isTrue|hasValue
		'=': 'aa=="vv"',//equal
		'!=': 'aa!="vv"', //unequal
		'~=': 'aa&&(" "+aa+" ").indexOf(" vv ")>-1',//onePart
		'|=': 'aa&&(aa+"-").indexOf("vv-")==0', //firstPart
		'^=': 'aa&&aa.indexOf("vv")==0', // beginWith
		'$=': 'aa&&aa.lastIndexOf("vv")==aa.length-"vv".length', // endWith
		'*=': 'aa&&aa.indexOf("vv")>-1' //contains
	},
	/**
	 * @property {Json} _shorthands 缩略写法
	 */
    _shorthands: [
		[/\#([\w\-]+)/g,'[id="$1"]'],//id缩略写法
		[/^([\w\-]+)/g, function(a,b){return '[tagName="'+b.toUpperCase()+'"]';}],//tagName缩略写法
		[/\.([\w\-]+)/g, '[className~="$1"]'],//className缩略写法
		[/^\*/g, '[tagName]']//任意tagName缩略写法
	],
	/**
	 * @property {Json} _pseudos 伪类逻辑
	 */
	_pseudos:{
		"first-child":function(a){return a.parentNode.getElementsByTagName("*")[0]==a;},
		"last-child":function(a){return !(a=a.nextSibling) || !a.tagName && !a.nextSibling;},
		"only-child":function(a){return getChildren(a.parentNode).length==1;},
		"nth-child":function(a,nth){return checkNth(a,nth); },
		"nth-last-child":function(a,nth){return checkNth(a,nth,true); },
		"first-of-type":function(a){ var tag=a.tagName; var el=a; while(el=el.previousSlibling){if(el.tagName==tag) return false;} return true;},
		"last-of-type":function(a){ var tag=a.tagName; var el=a; while(el=el.nextSibling){if(el.tagName==tag) return false;} return true; },
		"only-of-type":function(a){var els=a.parentNode.childNodes; for(var i=els.length-1;i>-1;i--){if(els[i].tagName==a.tagName && els[i]!=a) return false;} return true;},
		"nth-of-type":function(a,nth){var idx=1;var el=a;while(el=el.previousSibling) {if(el.tagName==a.tagName) idx++;} return checkNth(idx,nth); },//JK：懒得为这两个伪类作性能优化
		"nth-last-of-type":function(a,nth){var idx=1;var el=a;while(el=el.nextSibling) {if(el.tagName==a.tagName) idx++;} return checkNth(idx,nth); },//JK：懒得为这两个伪类作性能优化
		"empty":function(a){ return !a.firstChild; },
		"parent":function(a){ return !!a.firstChild; },
		"not":function(a,sSelector){ return !s2f(sSelector)(a); },
		"enabled":function(a){ return !a.disabled; },
		"disabled":function(a){ return a.disabled; },
		"checked":function(a){ return a.checked; },
		"contains":function(a,s){return (a.textContent || a.innerText || "").indexOf(s) >= 0;}
	},
	/**
	 * @property {Json} _attrGetters 常用的Element属性
	 */
	_attrGetters:function(){ 
		var o={'class': 'el.className',
			'for': 'el.htmlFor',
			'href':'el.getAttribute("href",2)'};
		var attrs='name,id,className,value,selected,checked,disabled,type,tagName,readOnly,offsetWidth,offsetHeight'.split(',');
		for(var i=0,a;a=attrs[i];i++) o[a]="el."+a;
		return o;
	}(),
	/**
	 * @property {Json} _relations selector关系运算符
	 */
	_relations:{
		//寻祖
		"":function(el,filter,topEl){
			while((el=el.parentNode) && el!=topEl){
				if(filter(el)) return el;
			}
			return null;
		},
		//寻父
		">":function(el,filter,topEl){
			el=el.parentNode;
			return el!=topEl&&filter(el) ? el:null;
		},
		//寻最小的哥哥
		"+":function(el,filter,topEl){
			while(el=el.previousSibling){
				if(el.tagName){
					return filter(el) && el;
				}
			}
			return null;
		},
		//寻所有的哥哥
		"~":function(el,filter,topEl){
			while(el=el.previousSibling){
				if(el.tagName && filter(el)){
					return el;
				}
			}
			return null;
		}
	},
	/** 
	 * 把一个selector字符串转化成一个过滤函数.
	 * @method selector2Filter
	 * @static
	 * @param {string} sSelector 过滤selector，这个selector里没有关系运算符（", >+~"）
	 * @returns {function} : 返回过滤函数。
	 * @example: 
		var fun=selector2Filter("input.aaa");alert(fun);
	 */
	selector2Filter:function(sSelector){
		return s2f(sSelector);
	},
	/** 
	 * 判断一个元素是否符合某selector.
	 * @method test 
	 * @static
	 * @param {HTMLElement} el: 被考察参数
	 * @param {string} sSelector: 过滤selector，这个selector里没有关系运算符（", >+~"）
	 * @returns {function} : 返回过滤函数。
	 */
	test:function(el,sSelector){
		return s2f(sSelector)(el);
	},
	/** 
	 * 用一个css selector来过滤一个数组.
	 * @method filter 
	 * @static
	 * @param {Array|Collection} els: 元素数组
	 * @param {string} sSelector: 过滤selector，这个selector里没有关系运算符（", >+~"）
	 * @param {Element} pEl: 父节点。默认是document.documentElement
	 * @returns {Array} : 返回满足过滤条件的元素组成的数组。
	 */
	filter:function(els,sSelector,pEl){
		var sltors=splitSelector(sSelector);
		return filterByRelation(pEl||document.documentElement,els,sltors);
	},
	/** 
	 * 以refEl为参考，得到符合过滤条件的HTML Elements. refEl可以是element或者是document
	 * @method query
	 * @static
	 * @param {HTMLElement} refEl: 参考对象
	 * @param {string} sSelector: 过滤selector,
	 * @returns {array} : 返回elements数组。
	 * @example: 
		var els=query(document,"li input.aaa");
		for(var i=0;i<els.length;i++ )els[i].style.backgroundColor='red';
	 */
	query:function(refEl,sSelector){
		Selector.queryStamp = queryStamp++;
		refEl=refEl||document.documentElement;
		var els=nativeQuery(refEl,sSelector);
		if(els) return els;//优先使用原生的
		var groups=trim(sSelector).split(",");
		els=querySimple(refEl,groups[0]);
		for(var i=1,gI;gI=groups[i];i++){
			var els2=querySimple(refEl,gI);
			els=els.concat(els2);
			//els=union(els,els2);//除重会太慢，放弃此功能
		}
		return els;
	},
	/** 
	 * 以refEl为参考，得到符合过滤条件的一个元素. refEl可以是element或者是document
	 * @method one
	 * @static
	 * @param {HTMLElement} refEl: 参考对象
	 * @param {string} sSelector: 过滤selector,
	 * @returns {HTMLElement} : 返回element，如果获取不到，则反回null。
	 * @example: 
		var els=query(document,"li input.aaa");
		for(var i=0;i<els.length;i++ )els[i].style.backgroundColor='red';
	 */
	one:function(refEl,sSelector){
		var els=Selector.query(refEl,sSelector);
		return els[0];
	}


};

window.__SltPsds=Selector._pseudos;//JK 2010-11-11：为提高效率
/*
	retTrue 一个返回为true的函数
*/
function retTrue(){
	return true;
}

/*
	arrFilter(arr,callback) : 对arr里的元素进行过滤
*/
function arrFilter(arr,callback){
	var rlt=[],i=0;
	if(callback==retTrue){
		if(arr instanceof Array) return arr.slice(0);
		else{
			for(var len=arr.length;i<len;i++) {
				rlt[i]=arr[i];
			}
		}
	}
	else{
		for(var oI;oI=arr[i++];) {
			callback(oI) && rlt.push(oI);
		}
	}
	return rlt;
};

var elContains,//部分浏览器不支持contains()，例如FF
	getChildren,//部分浏览器不支持children，例如FF3.5-
	hasNativeQuery,//部分浏览器不支持原生querySelectorAll()，例如IE8-
	findId=function(id) {return document.getElementById(id);};

(function(){
	var div=document.createElement('div');
	div.innerHTML='<div class="aaa"></div>';
	hasNativeQuery=(div.querySelectorAll && div.querySelectorAll('.aaa').length==1);
	elContains=div.contains?
		function(pEl,el){ return pEl!=el && pEl.contains(el);}:
		function(pEl,el){ return (pEl.compareDocumentPosition(el) & 16);};
	getChildren=div.children?
		function(pEl){ return pEl.children;}:
		function(pEl){ 
			return arrFilter(pEl.childNodes,function(el){return el.tagName;});
		};
})();


function checkNth(el,nth,reverse){
	if(nth=='n') return true;
	if(typeof el =='number') var idx=el;
	else{
		var pEl=el.parentNode;
		if(pEl.__queryStamp!=queryStamp){
			var els=getChildren(pEl);
			for(var i=0,elI;elI=els[i++];){
				elI.__siblingIdx=i;
			};
			pEl.__queryStamp=queryStamp;
			pEl.__childrenNum=i;
		}
		if(reverse) idx=pEl.__childrenNum-el.__siblingIdx+1;
		else idx=el.__siblingIdx;
	}
	switch (nth)
	{
		case 'even':
		case '2n':
			return idx%2==0;
		case 'odd':
		case '2n+1':
			return idx%2==1;
		default:
			if(!(/n/.test(nth))) return idx==nth;
			var arr=nth.replace(/(^|\D+)n/g,"$11n").split("n"),
				k=arr[0]|0,
				kn=idx-arr[1]|0;
			return k*kn>=0 && kn%k==0;
	}
}
/*
 * s2f(sSelector): 由一个selector得到一个过滤函数filter，这个selector里没有关系运算符（", >+~"）
 */
var filterCache={};
function s2f(sSelector,isForArray){
	if(!isForArray && filterCache[sSelector]) return filterCache[sSelector];
	var pseudos=[],//伪类数组,每一个元素都是数组，依次为：伪类名／伪类值
		attrs=[],//属性数组，每一个元素都是数组，依次为：属性名／属性比较符／比较值
		s=trim(sSelector);
	s=s.replace(/\:([\w\-]+)(\(([^)]+)\))?/g,function(a,b,c,d,e){pseudos.push([b,d]);return "";});//伪类
	for(var i=0,shorthands=Selector._shorthands,sh;sh=shorthands[i];i++)
		s=s.replace(sh[0],sh[1]);
	//var reg=/\[\s*([\w\-]+)\s*([!~|^$*]?\=)?\s*(?:(["']?)([^\]'"]*)\3)?\s*\]/g; //属性选择表达式解析
	var reg=/\[\s*((?:[\w\u00c0-\uFFFF-]|\\.)+)\s*(?:(\S?=)\s*(['"]*)(.*?)\3|)\s*\]/g; //属性选择表达式解析,thanks JQuery
	s=s.replace(reg,function(a,b,c,d,e){attrs.push([b,c||"",e||""]);return "";});//普通写法[foo][foo=""][foo~=""]等
	if(!(/^\s*$/).test(s)) {
		throw "Unsupported Selector:\n"+sSelector+"\n-"+s; 
	}

	var sFun=[];
	for(var i=0,attr;attr=attrs[i];i++){//属性过滤
		var attrGetter=Selector._attrGetters[attr[0]] || 'el.getAttribute("'+attr[0]+'")';
		sFun.push(Selector._operators[attr[1]].replace(/aa/g,attrGetter).replace(/vv/g,attr[2]));
	}
	for(var i=0,pI;pI=pseudos[i];i++) {//伪类过滤
		if(!Selector._pseudos[pI[0]]) throw "Unsupported Selector:\n"+pI[0]+"\n"+s;
		if(/^(nth-|not|contains)/.test(pI[0])){
			sFun.push('__SltPsds["'+pI[0]+'"](el,"'+encode4Js(pI[1])+'")');
		}
		else{
			sFun.push('__SltPsds["'+pI[0]+'"](el)');
		}
	}
	if (sFun.length)
	{
		if(isForArray){
			return new Function('els','var els2=[];for(var i=0,el;el=els[i++];){if('+sFun.join('&&')+') els2.push(el);} return els2;');
		}
		else{
			return filterCache[sSelector]=new Function('el','return '+sFun.join('&&')+';');
		}
	}
	else {
		if(isForArray){
			return function(els){return arrFilter(els,retTrue);}
		}
		else{
			return filterCache[sSelector]=retTrue;
		}
		
	}
};

/* 
	* {int} xxxStamp: 全局变量查询标记
 */
var queryStamp=0,
	relationStamp=0,
	querySimpleStamp=0;

/*
* nativeQuery(refEl,sSelector): 如果有原生的querySelectorAll，并且只是简单查询，则调用原生的query，否则返回null. 
* @param {Element} refEl 参考元素
* @param {string} sSelector selector字符串
* @returns 
*/
function nativeQuery(refEl,sSelector){
		if(hasNativeQuery && /^((^|,)\s*[.\w-][.\w\s\->+~]*)+$/.test(sSelector)) {
			//如果浏览器自带有querySelectorAll，并且本次query的是简单selector，则直接调用selector以加速
			//部分浏览器不支持以">~+"开始的关系运算符
			var arr=[],els=refEl.querySelectorAll(sSelector);
			for(var i=0,elI;elI=els[i++];) arr.push(elI);
			return arr;
		}
		return null;
};

/* 
* querySimple(pEl,sSelector): 得到pEl下的符合过滤条件的HTML Elements. 
* sSelector里没有","运算符
* pEl是默认是document.body 
* @see: query。
*/
function querySimple(pEl,sSelector){
	querySimpleStamp++;
	/*
		为了提高查询速度，有以下优先原则：
		最优先：原生查询
		次优先：在' '、'>'关系符出现前，优先正向（从祖到孙）查询
		次优先：id查询
		次优先：只有一个关系符，则直接查询
		最原始策略，采用关系判断，即：从最底层向最上层连线，能连得成功，则满足条件
	*/

	//最优先：原生查询
	var els=nativeQuery(pEl,sSelector);
	if(els) return els;//优先使用原生的


	var sltors=splitSelector(sSelector),
		sltorsLen=sltors.length;

	var pEls=[pEl],
		i,
		elI,
		pElI;

	var sltor0;
	//次优先：在' '、'>'关系符出现前，优先正向（从上到下）查询
	while(sltor0=sltors[0]){
		if(!pEls.length) return [];
		var relation=sltor0[0];
		els=[];
		if(relation=='+'){//第一个弟弟
			filter=s2f(sltor0[1]);
			for(i=0;elI=pEls[i++];){
				while(elI=elI.nextSibling){
					if(elI.tagName){
						if(filter(elI)) els.push(elI);
						break;
					}
				}
			}
			pEls=els;
			sltors.splice(0,1);
		}
		else if(relation=='~'){//所有的弟弟
			filter=s2f(sltor0[1]);
			for(i=0;elI=pEls[i++];){
				if(i>1 && elI.parentNode==pEls[i-2].parentNode) continue;//除重：如果已经query过兄长，则不必query弟弟
				while(elI=elI.nextSibling){
					if(elI.tagName){
						if(filter(elI)) els.push(elI);
					}
				}
			}
			pEls=els;
			sltors.splice(0,1);
		}
		else{
			break;
		}
	}
	if(!sltorsLen || !pEls.length) return pEls;
	
	//次优先：idIdx查询
	for(var idIdx=0,id;sltor=sltors[idIdx];idIdx++){
		if((/^[.\w-]*#([\w-]+)/i).test(sltor[1])){
			id=RegExp.$1;
			sltor[1]=sltor[1].replace('#'+id,'');
			break;
		}
	}
	if(idIdx<sltorsLen){//存在id
		var idEl=findId(id);
		if(!idEl) return [];
		for(i=0,pElI;pElI=pEls[i++];){
			if(elContains(pElI,idEl)) {
				els=filterByRelation(pEl,[idEl],sltors.slice(0,idIdx+1));
				if(!els.length || idIdx==sltorsLen-1) return els;
				return querySimple(idEl,sltors.slice(idIdx+1).join(',').replace(/,/g,' '));
			}
		}
		return [];
	}

	//---------------
	var getChildrenFun=function(pEl){return pEl.getElementsByTagName(tagName);},
		tagName='*',
		className='';
	sSelector=sltors[sltorsLen-1][1];
	sSelector=sSelector.replace(/^[\w\-]+/,function(a){tagName=a;return ""});
	if(hasNativeQuery){
		sSelector=sSelector.replace(/^[\w\*]*\.([\w\-]+)/,function(a,b){className=b;return ""});
	}
	if(className){
		getChildrenFun=function(pEl){return pEl.querySelectorAll(tagName+'.'+className);};
	}

	//次优先：只剩一个'>'或' '关系符(结合前面的代码，这时不可能出现还只剩'+'或'~'关系符)
	if(sltorsLen==1){
		if(sltors[0][0]=='>') {
			getChildrenFun=getChildren;
			var filter=s2f(sltors[0][1],true);
		}
		else{
			filter=s2f(sSelector,true);
		}
		els=[];
		for(i=0;pElI=pEls[i++];){
			els=els.concat(filter(getChildrenFun(pElI)));
		}
		return els;
	}


	//走第一个关系符是'>'或' '的万能方案
	sltors[sltors.length-1][1] = sSelector;
	els=[];
	for(i=0;pElI=pEls[i++];){
		els=els.concat(filterByRelation(pElI,getChildrenFun(pElI),sltors));
	}
	return els;
};


function splitSelector(sSelector){
	var sltors=[];
	var reg=/(^|\s*[>+~ ]\s*)(([\w\-\:.#*]+|\([^\)]*\)|\[\s*((?:[\w\u00c0-\uFFFF-]|\\.)+)\s*(?:(\S?=)\s*(['"]*)(.*?)\6|)\s*\])+)(?=($|\s*[>+~ ]\s*))/g;
	var s=trim(sSelector).replace(reg,function(a,b,c,d){sltors.push([trim(b),c]);return "";});
	if(!(/^\s*$/).test(s)) {
		throw "Unsupported Selector:\n"+sSelector+"\n--"+s; 
	}
	return sltors;
}

/*
判断一个长辈与子孙节点是否满足关系要求。----特别说明：这里的第一个关系只能是父子关系，或祖孙关系;
*/

function filterByRelation(pEl,els,sltors){
	relationStamp++;
	var sltor=sltors[0],
		len=sltors.length,
		needNotTopJudge=!sltor[0],
		filters=[],
		relations=[],
		needNext=[],
		relationsStr='';
		
	for(var i=0;i<len;i++){
		sltor=sltors[i];
		filters[i]=s2f(sltor[1],i==len-1);//过滤
		relations[i]=Selector._relations[sltor[0]];//寻亲函数
		if(sltor[0]=='' || sltor[0]=='~') needNext[i]=true;//是否递归寻亲
		relationsStr+=sltor[0]|' ';
	}
	els=filters[len-1](els);//自身过滤
	if(len==1) return els;
	if(/[+>~] |[+]~/.test(relationsStr)){//需要回溯
		alert(1);
		function chkRelation(el){//关系人过滤
			var parties=[],//中间关系人
				j=len-1,
				party=parties[j]=el;
			for(;j>-1;j--){
				if(j>0){//非最后一步的情况
					party=relations[j](party,filters[j-1],pEl);
				}
				else if(needNotTopJudge || party.parentNode==pEl){//最后一步通过判断
					return true;
				}
				else {//最后一步未通过判断
					party=null;
				}
				while(!party){//回溯
					if(++j==len) { //cache不通过
						return false;
					}
					if(needNext[j]) {
						party=parties[j-1];
						j++;
					}
				}
				parties[j-1]=party;
			}
		};
	}
	else{//不需回溯
		function chkRelation(el){//关系人过滤
			for(var j=len-1;j>0;j--){
				if(!(el=relations[j](el,filters[j-1],pEl))){
					return false;
				}
			}
			return needNotTopJudge || el.parentNode==pEl;
		};
	}
	return arrFilter(els,chkRelation);

}

QW.Selector=Selector;
})();
