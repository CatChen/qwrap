
(function(){
var HelperH=QW.HelperH;
describe('HelperH', {
	'helper':function(){
		value_of(QW.HelperH).log();
	},
	'applyTo':function(){
		var TestH = {
			a : function(){},
			b : function(){},
			c : function(){}
		}
		var t = {};

		QW.HelperH.applyTo(TestH,t);
		value_of(t).log();
	},
	'methodizeTo':function(){
		var TestH = {
			a : function(n){return n.x},
			b : function(n){return 2*n.x},
			c : function(n){return 3*n.x}
		}
		var T = function(x){
			this.x = x;
		};

		QW.HelperH.methodizeTo(TestH,T.prototype);
		value_of(T).log();
		var t = new T(10);
		value_of(t).log();
		value_of(t.a()).should_be(10);
		value_of(t.c()).should_be(30);
	},
	'methodizeToClass':function(){
		var TestH = {
			a : function(n){return n.x},
			b : function(n){return 2*n.x},
			c : function(n){return 3*n.x},
			z : 30
		}
		var T = function(x){
			this.x = x;
		};
		QW.HelperH.applyTo(TestH,T);
		QW.HelperH.methodizeTo(TestH,T.prototype);
		value_of(T).log();
		value_of(T.z).should_be(30);
		var t = new T(10);
		value_of(t).log();
		value_of(t.a()).should_be(10);
		value_of(t.c()).should_be(30);
	},
	'applyToWrap':function(){
		var TestH = {
			a : function(n){return n.x},
			b : function(n){return 2*n.x},
			c : function(n){return 3*n.x},
			z : 30
		}
		var core = {x:10};

		var Wrap = function(o){
			this.core = o;
		}

		QW.HelperH.applyTo(TestH,Wrap);

		var t = new Wrap(core);

		value_of(t).log();
		value_of(Wrap.a(t.core)).should_be(10);
	},
	'methodizeToWrap':function(){
		var TestH = {
			a : function(n){return n.x},
			b : function(n){return 2*n.x},
			c : function(n){return 3*n.x},
			z : 30
		}
		var core = {x:10};

		var Wrap = function(o){
			this.core = o;
		}

		QW.HelperH.methodizeTo(TestH,Wrap.prototype,"core");

		var t = new Wrap(core);

		value_of(t).log();
		value_of(t.a()).should_be(10);
	},
	'chain':function(){
		var TestH = {
			a : function(n){return n.x++},
			b : function(n){n.x*=2; return n},
			c : function(n){}
		}

		var core = {x:10};

		var Wrap = function(o){
			this.core = o;
		}
		
		TestH = QW.HelperH.rwrap(TestH, Wrap, {a:'operator', b:'queryer'});

		QW.HelperH.methodizeTo(TestH,Wrap.prototype,"core");
		var t = new Wrap(core);

		value_of(t).log();	
		value_of(t.a().a()).log();
		value_of(t.core.x).should_be(12);
		value_of(t.b().b()).log();
		value_of(t.core.x).should_be(48);
	},
	'gsetter':function(){
		var TestH = {
			getName : function(o){return o.name},
			setName : function(o,name){o.name=name;return o;}
		}

		var config = {name:['getName','setName']};

		
		TestH = QW.HelperH.gsetter(TestH, config);
		var o={};
		value_of(TestH.name(o)).should_be(undefined);
		value_of(TestH.name(o,'JK').name).should_be('JK');
	},
	'mul':function(){
		var TestH = {
			a : function(n){return ++n.x},
			b : function(n){n.x*=2; return n},
			c : function(n){}
		}
		var core = [{x:10},{x:20},{x:30}];
		var Wrap = function(o){
			this.core = o;
		}

		TestH = QW.HelperH.mul(TestH);
		TestH = QW.HelperH.rwrap(TestH, Wrap ,{a:'operator', b:'queryer'});
		value_of(TestH.a(core)).log();
		
		QW.HelperH.methodizeTo(TestH,Wrap.prototype,"core");
		var t = new Wrap(core);
	
		value_of(t.a().b()).log();
		value_of(t.core[1].x).should_be(44);
	},
	'List':function(){
		function List(items){
			this.items = items;
		}

		var TestH = {
			a : function(n){return ++n.x},
			b : function(n){n.x*=2; return n},
			c : function(n){}
		}
			
		var items = [{x:10},{x:20},{x:30}];
		var t = new List(items);

		TestH = QW.HelperH.mul(TestH);
		TestH = QW.HelperH.rwrap(TestH, List, {a:'operator', b:'queryer'});
		QW.HelperH.methodizeTo(TestH,List.prototype,"items");
		
		value_of(t.a().b()).log();
		value_of(t.items[2].x).should_be(62);
	}
});

})();