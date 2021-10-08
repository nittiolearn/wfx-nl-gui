/* Modernizr 2.0.6 (Custom Build) | MIT & BSD
 * Build: http://www.modernizr.com/download/#-fontface-backgroundsize-borderimage-borderradius-boxshadow-flexbox-hsla-multiplebgs-opacity-rgba-textshadow-cssanimations-csscolumns-generatedcontent-cssgradients-cssreflections-csstransforms-csstransforms3d-csstransitions-applicationcache-canvas-canvastext-draganddrop-hashchange-history-audio-video-indexeddb-input-inputtypes-localstorage-postmessage-sessionstorage-websockets-websqldatabase-webworkers-geolocation-inlinesvg-smil-svg-svgclippaths-touch-webgl-iepp-cssclasses-teststyles-testprop-testallprops-hasevent-prefixes-domprefixes-load
 */
;
window.Modernizr = function(a, b, c) {
	function H() {
		e.input = function(a) {
			for (var b = 0, c = a.length; b < c; b++)
				t[a[b]] = a[b] in l;
			return t
		}("autocomplete autofocus list placeholder max min multiple pattern required step".split(" ")), e.inputtypes = function(a) {
			for (var d = 0, e, f, h, i = a.length; d < i; d++)
				l.setAttribute("type", f = a[d]), e = l.type !== "text", e && (l.value = m, l.style.cssText = "position:absolute;visibility:hidden;", /^range$/.test(f) && l.style.WebkitAppearance !== c ? (g.appendChild(l), h = b.defaultView, e = h.getComputedStyle && h.getComputedStyle(l, null).WebkitAppearance !== "textfield" && l.offsetHeight !== 0, g.removeChild(l)) : /^(search|tel)$/.test(f) || (/^(url|email)$/.test(f) ? e = l.checkValidity && l.checkValidity() === !1 : /^color$/.test(f) ? (g.appendChild(l), g.offsetWidth, e = l.value != m, g.removeChild(l)) : e = l.value != m)), s[a[d]] = !!e;
			return s
		}("search tel url email datetime date month week time datetime-local number range color".split(" "))
	}

	function F(a, b) {
		var c = a.charAt(0).toUpperCase() + a.substr(1), d = (a + " " + p.join(c + " ") + c).split(" ");
		return E(d, b)
	}

	function E(a, b) {
		for (var d in a)
		if (k[a[d]] !== c)
			return b == "pfx" ? a[d] : !0;
		return !1
	}

	function D(a, b) {
		return !!~("" + a).indexOf(b)
	}

	function C(a, b) {
		return typeof a === b
	}

	function B(a, b) {
		return A(o.join(a + ";") + (b || ""))
	}

	function A(a) {
		k.cssText = a
	}

	var d = "2.0.6", e = {}, f = !0, g = b.documentElement, h = b.head || b.getElementsByTagName("head")[0], i = "modernizr", j = b.createElement(i), k = j.style, l = b.createElement("input"), m = ":)", n = Object.prototype.toString, o = " -webkit- -moz- -o- -ms- -khtml- ".split(" "), p = "Webkit Moz O ms Khtml".split(" "), q = {
		svg : "http://www.w3.org/2000/svg"
	}, r = {}, s = {}, t = {}, u = [], v = function(a, c, d, e) {
		var f, h, j, k = b.createElement("div");
		if (parseInt(d, 10))
			while (d--) j = b.createElement("div"), j.id = e ? e[d] : i + (d + 1), k.appendChild(j);
		f = ["&shy;", "<style>", a, "</style>"].join(""), k.id = i, k.innerHTML += f, g.appendChild(k), h = c(k, a), k.parentNode.removeChild(k);
		return !!h
	}, w = function() {
		function d(d, e) {
			e = e || b.createElement(a[d] || "div"), d = "on" + d;
			var f = d in e;
			f || (e.setAttribute || ( e = b.createElement("div")), e.setAttribute && e.removeAttribute && (e.setAttribute(d, ""), f = C(e[d], "function"), C(e[d], c) || (e[d] = c), e.removeAttribute(d))), e = null;
			return f
		}

		var a = {
			select : "input",
			change : "input",
			submit : "form",
			reset : "form",
			error : "img",
			load : "img",
			abort : "img"
		};
		return d
	}(), x, y = {}.hasOwnProperty, z;
	!C(y, c) && !C(y.call, c) ? z = function(a, b) {
		return y.call(a, b)
	} : z = function(a, b) {
		return b in a && C(a.constructor.prototype[b], c)
	};
	var G = function(c, d) {
		var f = c.join(""), g = d.length;
		v(f, function(c, d) {
			var f = b.styleSheets[b.styleSheets.length - 1], h = f.cssRules && f.cssRules[0] ? f.cssRules[0].cssText : f.cssText || "", i = c.childNodes, j = {};
			while (g--)
			j[i[g].id] = i[g];
			e.touch = "ontouchstart" in a || j.touch.offsetTop === 9, e.csstransforms3d = j.csstransforms3d.offsetLeft === 9, e.generatedcontent = j.generatedcontent.offsetHeight >= 1, e.fontface = /src/i.test(h) && h.indexOf(d.split(" ")[0]) === 0
		}, g, d)
	}(['@font-face {font-family:"font";src:url("https://")}', ["@media (", o.join("touch-enabled),("), i, ")", "{#touch{top:9px;position:absolute}}"].join(""), ["@media (", o.join("transform-3d),("), i, ")", "{#csstransforms3d{left:9px;position:absolute}}"].join(""), ['#generatedcontent:after{content:"', m, '";visibility:hidden}'].join("")], ["fontface", "touch", "csstransforms3d", "generatedcontent"]);
	r.flexbox = function() {
		function c(a, b, c, d) {
			a.style.cssText = o.join(b + ":" + c + ";") + (d || "")
		}

		function a(a, b, c, d) {
			b += ":", a.style.cssText = (b + o.join(c + ";" + b)).slice(0, -b.length) + (d || "")
		}

		var d = b.createElement("div"), e = b.createElement("div");
		a(d, "display", "box", "width:42px;padding:0;"), c(e, "box-flex", "1", "width:10px;"), d.appendChild(e), g.appendChild(d);
		var f = e.offsetWidth === 42;
		d.removeChild(e), g.removeChild(d);
		return f
	}, r.canvas = function() {
		var a = b.createElement("canvas");
		return !!a.getContext && !!a.getContext("2d")
	}, r.canvastext = function() {
		return !!e.canvas && !!C(b.createElement("canvas").getContext("2d").fillText, "function")
	}, r.webgl = function() {
		return !!a.WebGLRenderingContext
	}, r.touch = function() {
		return e.touch
	}, r.geolocation = function() {
		return !!navigator.geolocation
	}, r.postmessage = function() {
		return !!a.postMessage
	}, r.websqldatabase = function() {
		var b = !!a.openDatabase;
		return b
	}, r.indexedDB = function() {
		for (var b = -1, c = p.length; ++b < c; )
			if (a[p[b].toLowerCase() + "IndexedDB"])
				return !0;
		return !!a.indexedDB
	}, r.hashchange = function() {
		return w("hashchange", a) && (b.documentMode === c || b.documentMode > 7)
	}, r.history = function() {
		return !!a.history && !!history.pushState
	}, r.draganddrop = function() {
		return w("dragstart") && w("drop")
	}, r.websockets = function() {
		for (var b = -1, c = p.length; ++b < c; )
			if (a[p[b] + "WebSocket"])
				return !0;
		return "WebSocket" in a
	}, r.rgba = function() {
		A("background-color:rgba(150,255,150,.5)");
		return D(k.backgroundColor, "rgba")
	}, r.hsla = function() {
		A("background-color:hsla(120,40%,100%,.5)");
		return D(k.backgroundColor, "rgba") || D(k.backgroundColor, "hsla")
	}, r.multiplebgs = function() {
		A("background:url(https://),url(https://),red url(https://)");
		return /(url\s*\(.*?){3}/.test(k.background)
	}, r.backgroundsize = function() {
		return F("backgroundSize")
	}, r.borderimage = function() {
		return F("borderImage")
	}, r.borderradius = function() {
		return F("borderRadius")
	}, r.boxshadow = function() {
		return F("boxShadow")
	}, r.textshadow = function() {
		return b.createElement("div").style.textShadow === ""
	}, r.opacity = function() {
		B("opacity:.55");
		return /^0.55$/.test(k.opacity)
	}, r.cssanimations = function() {
		return F("animationName")
	}, r.csscolumns = function() {
		return F("columnCount")
	}, r.cssgradients = function() {
		var a = "background-image:", b = "gradient(linear,left top,right bottom,from(#9f9),to(white));", c = "linear-gradient(left top,#9f9, white);";
		A((a + o.join(b + a) + o.join(c + a)).slice(0, -a.length));
		return D(k.backgroundImage, "gradient")
	}, r.cssreflections = function() {
		return F("boxReflect")
	}, r.csstransforms = function() {
		return !!E(["transformProperty", "WebkitTransform", "MozTransform", "OTransform", "msTransform"])
	}, r.csstransforms3d = function() {
		var a = !!E(["perspectiveProperty", "WebkitPerspective", "MozPerspective", "OPerspective", "msPerspective"]);
		a && "webkitPerspective" in g.style && ( a = e.csstransforms3d);
		return a
	}, r.csstransitions = function() {
		return F("transitionProperty")
	}, r.fontface = function() {
		return e.fontface
	}, r.generatedcontent = function() {
		return e.generatedcontent
	}, r.video = function() {
		var a = b.createElement("video"), c = !1;
		try {
			if ( c = !!a.canPlayType) {
				c = new Boolean(c), c.ogg = a.canPlayType('video/ogg; codecs="theora"');
				var d = 'video/mp4; codecs="avc1.42E01E';
				c.h264 = a.canPlayType(d + '"') || a.canPlayType(d + ', mp4a.40.2"'), c.webm = a.canPlayType('video/webm; codecs="vp8, vorbis"')
			}
		} catch(e) {
		}
		return c
	}, r.audio = function() {
		var a = b.createElement("audio"), c = !1;
		try {
			if ( c = !!a.canPlayType)
				c = new Boolean(c), c.ogg = a.canPlayType('audio/ogg; codecs="vorbis"'), c.mp3 = a.canPlayType("audio/mpeg;"), c.wav = a.canPlayType('audio/wav; codecs="1"'), c.m4a = a.canPlayType("audio/x-m4a;") || a.canPlayType("audio/aac;")
		} catch(d) {
		}
		return c
	}, r.localstorage = function() {
		try {
			return !!localStorage.getItem
		} catch(a) {
			return !1
		}
	}, r.sessionstorage = function() {
		try {
			return !!sessionStorage.getItem
		} catch(a) {
			return !1
		}
	}, r.webworkers = function() {
		return !!a.Worker
	}, r.applicationcache = function() {
		return !!a.applicationCache
	}, r.svg = function() {
		return !!b.createElementNS && !!b.createElementNS(q.svg, "svg").createSVGRect
	}, r.inlinesvg = function() {
		var a = b.createElement("div");
		a.innerHTML = "<svg/>";
		return (a.firstChild && a.firstChild.namespaceURI) == q.svg
	}, r.smil = function() {
		return !!b.createElementNS && /SVG/.test(n.call(b.createElementNS(q.svg, "animate")))
	}, r.svgclippaths = function() {
		return !!b.createElementNS && /SVG/.test(n.call(b.createElementNS(q.svg, "clipPath")))
	};
	for (var I in r)z(r, I) && ( x = I.toLowerCase(), e[x] = r[I](), u.push((e[x] ? "" : "no-") + x));
	e.input || H(), A(""), j = l = null, a.attachEvent && function() {
		var a = b.createElement("div");
		a.innerHTML = "<elem></elem>";
		return a.childNodes.length !== 1
	}() && function(a, b) {
		function s(a) {
			var b = -1;
			while (++b < g)
			a.createElement(f[b])
		}
		a.iepp = a.iepp || {};
		var d = a.iepp, e = d.html5elements || "abbr|article|aside|audio|canvas|datalist|details|figcaption|figure|footer|header|hgroup|mark|meter|nav|output|progress|section|summary|time|video", f = e.split("|"), g = f.length, h = new RegExp("(^|\\s)(" + e + ")", "gi"), i = new RegExp("<(/*)(" + e + ")", "gi"), j = /^\s*[\{\}]\s*$/, k = new RegExp("(^|[^\\n]*?\\s)(" + e + ")([^\\n]*)({[\\n\\w\\W]*?})", "gi"), l = b.createDocumentFragment(), m = b.documentElement, n = m.firstChild, o = b.createElement("body"), p = b.createElement("style"), q = /print|all/, r;
		d.getCSS = function(a, b) {
			if (a + "" === c)
				return "";
			var e = -1, f = a.length, g, h = [];
			while (++e < f) {
				g = a[e];
				if (g.disabled)
					continue;
				b = g.media || b, q.test(b) && h.push(d.getCSS(g.imports, b), g.cssText), b = "all"
			}
			return h.join("")
		}, d.parseCSS = function(a) {
			var b = [], c;
			while (( c = k.exec(a)) != null)
			b.push(((j.exec(c[1]) ? "\n" : c[1]) + c[2] + c[3]).replace(h, "$1.iepp_$2") + c[4]);
			return b.join("\n")
		}, d.writeHTML = function() {
			var a = -1;
			r = r || b.body;
			while (++a < g) {
				var c = b.getElementsByTagName(f[a]), d = c.length, e = -1;
				while (++e < d)c[e].className.indexOf("iepp_") < 0 && (c[e].className += " iepp_" + f[a])
			}
			l.appendChild(r), m.appendChild(o), o.className = r.className, o.id = r.id, o.innerHTML = r.innerHTML.replace(i, "<$1font")
		}, d._beforePrint = function() {
			p.styleSheet.cssText = d.parseCSS(d.getCSS(b.styleSheets, "all")), d.writeHTML()
		}, d.restoreHTML = function() {
			o.innerHTML = "", m.removeChild(o), m.appendChild(r)
		}, d._afterPrint = function() {
			d.restoreHTML(), p.styleSheet.cssText = ""
		}, s(b), s(l);
		d.disablePP || (n.insertBefore(p, n.firstChild), p.media = "print", p.className = "iepp-printshim", a.attachEvent("onbeforeprint", d._beforePrint), a.attachEvent("onafterprint", d._afterPrint))
	}(a, b), e._version = d, e._prefixes = o, e._domPrefixes = p, e.hasEvent = w, e.testProp = function(a) {
		return E([a])
	}, e.testAllProps = F, e.testStyles = v, g.className = g.className.replace(/\bno-js\b/, "") + ( f ? " js " + u.join(" ") : "");
	return e
}(this, this.document), function(a, b, c) {
	function k(a) {
		return !a || a == "loaded" || a == "complete"
	}

	function j() {
		var a = 1, b = -1;
		while (p.length - ++b)
		if (p[b].s && !( a = p[b].r))
			break;
		a && g()
	}

	function i(a) {
		var c = b.createElement("script"), d;
		c.src = a.s, c.onreadystatechange = c.onload = function() {
			!d && k(c.readyState) && ( d = 1, j(), c.onload = c.onreadystatechange = null)
		}, m(function() {
			d || ( d = 1, j())
		}, H.errorTimeout), a.e ? c.onload() : n.parentNode.insertBefore(c, n)
	}

	function h(a) {
		var c = b.createElement("link"), d;
		c.href = a.s, c.rel = "stylesheet", c.type = "text/css";
		if (!a.e && (w || r)) {
			var e = function(a) {
				m(function() {
					if (!d)
						try {
							a.sheet.cssRules.length ? ( d = 1, j()) : e(a)
						} catch(b) {
							b.code == 1e3 || b.message == "security" || b.message == "denied" ? ( d = 1, m(function() {
								j()
							}, 0)) : e(a)
						}
				}, 0)
			};
			e(c)
		} else
			c.onload = function() {
				d || ( d = 1, m(function() {
					j()
				}, 0))
			}, a.e && c.onload();
		m(function() {
			d || ( d = 1, j())
		}, H.errorTimeout), !a.e && n.parentNode.insertBefore(c, n)
	}

	function g() {
		var a = p.shift();
		q = 1, a ? a.t ? m(function() {
			a.t == "c" ? h(a) : i(a)
		}, 0) : (a(), j()) : q = 0
	}

	function f(a, c, d, e, f, h) {
		function i() {
			!o && k(l.readyState) && (r.r = o = 1, !q && j(), l.onload = l.onreadystatechange = null, m(function() {
				u.removeChild(l)
			}, 0))
		}

		var l = b.createElement(a), o = 0, r = {
			t : d,
			s : c,
			e : h
		};
		l.src = l.data = c, !s && (l.style.display = "none"), l.width = l.height = "0", a != "object" && (l.type = d), l.onload = l.onreadystatechange = i, a == "img" ? l.onerror = i : a == "script" && (l.onerror = function() {
			r.e = r.r = 1, g()
		}), p.splice(e, 0, r), u.insertBefore(l, s ? null : n), m(function() {
			o || (u.removeChild(l), r.r = r.e = o = 1, j())
		}, H.errorTimeout)
	}

	function e(a, b, c) {
		var d = b == "c" ? z : y;
		q = 0, b = b || "j", C(a) ? f(d, a, b, this.i++, l, c) : (p.splice(this.i++, 0, a), p.length == 1 && g());
		return this
	}

	function d() {
		var a = H;
		a.loader = {
			load : e,
			i : 0
		};
		return a
	}

	var l = b.documentElement, m = a.setTimeout, n = b.getElementsByTagName("script")[0], o = {}.toString, p = [], q = 0, r = "MozAppearance" in l.style, s = r && !!b.createRange().compareNode, t = r && !s, u = s ? l : n.parentNode, v = a.opera && o.call(a.opera) == "[object Opera]", w = "webkitAppearance" in l.style, x = w && "async" in b.createElement("script"), y = r ? "object" : v || x ? "img" : "script", z = w ? "img" : y, A = Array.isArray ||
	function(a) {
		return o.call(a) == "[object Array]"
	}, B = function(a) {
		return Object(a) === a
	}, C = function(a) {
		return typeof a == "string"
	}, D = function(a) {
		return o.call(a) == "[object Function]"
	}, E = [], F = {}, G, H;
	H = function(a) {
		function f(a) {
			var b = a.split("!"), c = E.length, d = b.pop(), e = b.length, f = {
				url : d,
				origUrl : d,
				prefixes : b
			}, g, h;
			for ( h = 0; h < e; h++)
				g = F[b[h]], g && ( f = g(f));
			for ( h = 0; h < c; h++)
				f = E[h](f);
			return f
		}

		function e(a, b, e, g, h) {
			var i = f(a), j = i.autoCallback;
			if (!i.bypass) {
				b && ( b = D(b) ? b : b[a] || b[g] || b[a.split("/").pop().split("?")[0]]);
				if (i.instead)
					return i.instead(a, b, e, g, h);
				e.load(i.url, i.forceCSS || !i.forceJS && /css$/.test(i.url) ? "c" : c, i.noexec), (D(b) || D(j)) && e.load(function() {
					d(), b && b(i.origUrl, h, g), j && j(i.origUrl, h, g)
				})
			}
		}

		function b(a, b) {
			function c(a) {
				if (C(a))
					e(a, h, b, 0, d);
				else if (B(a))
					for (i in a)a.hasOwnProperty(i) && e(a[i], h, b, i, d)
			}

			var d = !!a.test, f = d ? a.yep : a.nope, g = a.load || a.both, h = a.callback, i;
			c(f), c(g), a.complete && b.load(a.complete)
		}

		var g, h, i = this.yepnope.loader;
		if (C(a))
			e(a, 0, i, 0);
		else if (A(a))
			for ( g = 0; g < a.length; g++)
				h = a[g], C(h) ? e(h, 0, i, 0) : A(h) ? H(h) : B(h) && b(h, i);
		else
			B(a) && b(a, i)
	}, H.addPrefix = function(a, b) {
		F[a] = b
	}, H.addFilter = function(a) {
		E.push(a)
	}, H.errorTimeout = 1e4, b.readyState == null && b.addEventListener && (b.readyState = "loading", b.addEventListener("DOMContentLoaded", G = function() {
		b.removeEventListener("DOMContentLoaded", G, 0), b.readyState = "complete"
	}, 0)), a.yepnope = d()
}(this, this.document), Modernizr.load = function() {
	yepnope.apply(window, [].slice.call(arguments, 0))
};
