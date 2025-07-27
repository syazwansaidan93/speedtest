let testState = -1;
let dlStatus = "";
let ulStatus = "";
let pingStatus = "";
let jitterStatus = "";
let clientIp = "";
let dlProgress = 0;
let ulProgress = 0;
let pingProgress = 0;
let testId = null;


let settings = {
	test_order: "P_D_U",
	time_ul_max: 15,
	time_dl_max: 15,
	time_auto: true,
	time_ulGraceTime: 3,
	time_dlGraceTime: 1.5,
	count_ping: 10,
	url_dl: "garbage.php",
	url_ul: "empty.php",
	url_ping: "empty.php",
	xhr_dlMultistream: 6,
	xhr_ulMultistream: 3,
	xhr_multistreamDelay: 300,
	xhr_ignoreErrors: 1,
	xhr_dlUseBlob: false,
	xhr_ul_blob_megabytes: 20,
	garbagePhp_chunkSize: 100,
	enable_quirks: true,
	ping_allowPerformanceApi: true,
	overheadCompensationFactor: 1.06,
	useMebibits: false,
	telemetry_level: 0,
    forceIE11Workaround: false
};

let xhr = null;
let interval = null;
let test_pointer = 0;

function url_sep(url) {
	return url.match(/\?/) ? "&" : "?";
}

this.addEventListener("message", function(e) {
	const params = e.data.split(" ");
	if (params[0] === "status") {
		postMessage(
			JSON.stringify({
				testState: testState,
				dlStatus: dlStatus,
				ulStatus: ulStatus,
				pingStatus: pingStatus,
				clientIp: clientIp,
				jitterStatus: jitterStatus,
				dlProgress: dlProgress,
				ulProgress: ulProgress,
				pingProgress: pingProgress,
				testId: testId
			})
		);
	}
	if (params[0] === "start" && testState === -1) {
		testState = 0;
		try {
			let s = {};
			try {
				const ss = e.data.substring(5);
				if (ss) s = JSON.parse(ss);
			} catch (e) {
				console.warn("Error parsing custom settings JSON. Please check your syntax");
			}
			for (let key in s) {
				if (typeof settings[key] !== "undefined") settings[key] = s[key];
				else console.warn("Unknown setting ignored: " + key);
			}
			const ua = navigator.userAgent;
			if (settings.enable_quirks || (typeof s.enable_quirks !== "undefined" && s.enable_quirks)) {
				if (/Firefox.(\d+\.\d+)/i.test(ua)) {
					if (typeof s.ping_allowPerformanceApi === "undefined") {
						settings.ping_allowPerformanceApi = false;
					}
				}
				if (/Edge.(\d+\.\d+)/i.test(ua)) {
					if (typeof s.xhr_dlMultistream === "undefined") {
						settings.xhr_dlMultistream = 3;
					}
				}
				if (/Chrome.(\d+)/i.test(ua) && !!self.fetch) {
					if (typeof s.xhr_dlMultistream === "undefined") {
						settings.xhr_dlMultistream = 5;
					}
				}
			}
			if (/Edge.(\d+\.\d+)/i.test(ua)) {
				settings.forceIE11Workaround = true;
			}
			if (/PlayStation 4.(\d+\.\d+)/i.test(ua)) {
				settings.forceIE11Workaround = true;
			}
			if (/Chrome.(\d+)/i.test(ua) && /Android|iPhone|iPad|iPod|Windows Phone/i.test(ua)) {
				settings.xhr_ul_blob_megabytes = 4;
			}
			if (/^((?!chrome|android|crios|fxios).)*safari/i.test(ua)) {
				settings.forceIE11Workaround = true;
			}
			settings.test_order = settings.test_order.toUpperCase();
		} catch (e) {
			console.warn("Possible error in custom test settings. Some settings might not have been applied. Exception: " + e);
		}
		test_pointer = 0;
		let dRun = false,
			uRun = false,
			pRun = false;
		const runNextTest = function() {
			if (testState == 5) return;
			if (test_pointer >= settings.test_order.length) {
				testState = 4;
				return;
			}
			switch (settings.test_order.charAt(test_pointer)) {
				case "D":
					{
						test_pointer++;
						if (dRun) {
							runNextTest();
							return;
						} else dRun = true;
						testState = 1;
						dlTest(runNextTest);
					}
					break;
				case "U":
					{
						test_pointer++;
						if (uRun) {
							runNextTest();
							return;
						} else uRun = true;
						testState = 3;
						ulTest(runNextTest);
					}
					break;
				case "P":
					{
						test_pointer++;
						if (pRun) {
							runNextTest();
							return;
						} else pRun = true;
						testState = 2;
						pingTest(runNextTest);
					}
					break;
				case "_":
					{
						test_pointer++;
						setTimeout(runNextTest, 1000);
					}
					break;
				default:
					test_pointer++;
			}
		};
		runNextTest();
	}
	if (params[0] === "abort") {
        if (testState >= 4) return;
		clearRequests();
		runNextTest = null;
		if (interval) clearInterval(interval);
		testState = 5;
		dlStatus = "";
		ulStatus = "";
		pingStatus = "";
		jitterStatus = "";
        clientIp = "";
		dlProgress = 0;
		ulProgress = 0;
		pingProgress = 0;
	}
});
function clearRequests() {
	if (xhr) {
		for (let i = 0; i < xhr.length; i++) {
			try {
				xhr[i].onprogress = null;
				xhr[i].onload = null;
				xhr[i].onerror = null;
			} catch (e) {}
			try {
				xhr[i].upload.onprogress = null;
				xhr[i].upload.onload = null;
				xhr[i].upload.onerror = null;
			} catch (e) {}
			try {
				xhr[i].abort();
			} catch (e) {}
			try {
				delete xhr[i];
			} catch (e) {}
		}
		xhr = null;
	}
}
let dlCalled = false;
function dlTest(done) {
	if (dlCalled) return;
	else dlCalled = true;
	let totLoaded = 0.0,
		startT = new Date().getTime(),
		bonusT = 0,
		graceTimeDone = false,
		failed = false;
	xhr = [];
	const testStream = function(i, delay) {
		setTimeout(
			function() {
				if (testState !== 1) return;
				let prevLoaded = 0;
				let x = new XMLHttpRequest();
				xhr[i] = x;
				xhr[i].onprogress = function(event) {
					if (testState !== 1) {
						try {
							x.abort();
						} catch (e) {}
					}
					const loadDiff = event.loaded <= 0 ? 0 : event.loaded - prevLoaded;
					if (isNaN(loadDiff) || !isFinite(loadDiff) || loadDiff < 0) return;
					totLoaded += loadDiff;
					prevLoaded = event.loaded;
				}.bind(this);
				xhr[i].onload = function() {
					try {
						xhr[i].abort();
					} catch (e) {}
					testStream(i, 0);
				}.bind(this);
				xhr[i].onerror = function() {
					if (settings.xhr_ignoreErrors === 0) failed = true;
					try {
						xhr[i].abort();
					} catch (e) {}
					delete xhr[i];
					if (settings.xhr_ignoreErrors === 1) testStream(i, 0);
				}.bind(this);
				try {
					if (settings.xhr_dlUseBlob) xhr[i].responseType = "blob";
					else xhr[i].responseType = "arraybuffer";
				} catch (e) {}
				xhr[i].open("GET", settings.url_dl + url_sep(settings.url_dl) + "r=" + Math.random() + "&ckSize=" + settings.garbagePhp_chunkSize, true);
				xhr[i].send();
			}.bind(this),
			1 + delay
		);
	}.bind(this);
	for (let i = 0; i < settings.xhr_dlMultistream; i++) {
		testStream(i, settings.xhr_multistreamDelay * i);
	}
	interval = setInterval(
		function() {
			const t = new Date().getTime() - startT;
			if (graceTimeDone) dlProgress = (t + bonusT) / (settings.time_dl_max * 1000);
			if (t < 200) return;
			if (!graceTimeDone) {
				if (t > 1000 * settings.time_dlGraceTime) {
					if (totLoaded > 0) {
						startT = new Date().getTime();
						bonusT = 0;
						totLoaded = 0.0;
					}
					graceTimeDone = true;
				}
			} else {
				const speed = totLoaded / (t / 1000.0);
				if (settings.time_auto) {
					const bonus = (5.0 * speed) / 100000;
					bonusT += bonus > 400 ? 400 : bonus;
				}
				dlStatus = ((speed * 8 * settings.overheadCompensationFactor) / (settings.useMebibits ? 1048576 : 1000000)).toFixed(2);
				if ((t + bonusT) / 1000.0 > settings.time_dl_max || failed) {
					if (failed || isNaN(dlStatus)) dlStatus = "Fail";
					clearRequests();
					clearInterval(interval);
					dlProgress = 1;
					done();
				}
			}
		}.bind(this),
		200
	);
}
let ulCalled = false;
function ulTest(done) {
	if (ulCalled) return;
	else ulCalled = true;
	let r = new ArrayBuffer(1048576);
	const maxInt = Math.pow(2, 32) - 1;
	try {
		r = new Uint32Array(r);
		for (let i = 0; i < r.length; i++) r[i] = Math.random() * maxInt;
	} catch (e) {}
	let req = [];
	let reqsmall = [];
	for (let i = 0; i < settings.xhr_ul_blob_megabytes; i++) req.push(r);
	req = new Blob(req);
	r = new ArrayBuffer(262144);
	try {
		r = new Uint32Array(r);
		for (let i = 0; i < r.length; i++) r[i] = Math.random() * maxInt;
	} catch (e) {}
	reqsmall.push(r);
	reqsmall = new Blob(reqsmall);
	const testFunction = function() {
		let totLoaded = 0.0,
			startT = new Date().getTime(),
			bonusT = 0,
			graceTimeDone = false,
			failed = false;
		xhr = [];
		const testStream = function(i, delay) {
			setTimeout(
				function() {
					if (testState !== 3) return;
					let prevLoaded = 0;
					let x = new XMLHttpRequest();
					xhr[i] = x;
					let ie11workaround;
					if (settings.forceIE11Workaround) ie11workaround = true;
					else {
						try {
							xhr[i].upload.onprogress;
							ie11workaround = false;
						} catch (e) {
							ie11workaround = true;
						}
					}
					if (ie11workaround) {
						xhr[i].onload = xhr[i].onerror = function() {
							totLoaded += reqsmall.size;
							testStream(i, 0);
						};
						xhr[i].open("POST", settings.url_ul + url_sep(settings.url_ul) + "r=" + Math.random(), true);
						try {
							xhr[i].setRequestHeader("Content-Encoding", "identity");
						} catch (e) {}
						xhr[i].send(reqsmall);
					} else {
						xhr[i].upload.onprogress = function(event) {
							if (testState !== 3) {
								try {
									x.abort();
								} catch (e) {}
							}
							const loadDiff = event.loaded <= 0 ? 0 : event.loaded - prevLoaded;
							if (isNaN(loadDiff) || !isFinite(loadDiff) || loadDiff < 0) return;
							totLoaded += loadDiff;
							prevLoaded = event.loaded;
						}.bind(this);
						xhr[i].upload.onload = function() {
							testStream(i, 0);
						}.bind(this);
						xhr[i].upload.onerror = function() {
							if (settings.xhr_ignoreErrors === 0) failed = true;
							try {
								xhr[i].abort();
							} catch (e) {}
							delete xhr[i];
							if (settings.xhr_ignoreErrors === 1) testStream(i, 0);
						}.bind(this);
						xhr[i].open("POST", settings.url_ul + url_sep(settings.url_ul) + "r=" + Math.random(), true);
						try {
							xhr[i].setRequestHeader("Content-Encoding", "identity");
						} catch (e) {}
						xhr[i].send(req);
					}
				}.bind(this),
				delay
			);
		}.bind(this);
		for (let i = 0; i < settings.xhr_ulMultistream; i++) {
			testStream(i, settings.xhr_multistreamDelay * i);
		}
		interval = setInterval(
			function() {
				const t = new Date().getTime() - startT;
				if (graceTimeDone) ulProgress = (t + bonusT) / (settings.time_ul_max * 1000);
				if (t < 200) return;
				if (!graceTimeDone) {
					if (t > 1000 * settings.time_ulGraceTime) {
						if (totLoaded > 0) {
							startT = new Date().getTime();
							bonusT = 0;
							totLoaded = 0.0;
						}
						graceTimeDone = true;
					}
				} else {
					const speed = totLoaded / (t / 1000.0);
					if (settings.time_auto) {
						const bonus = (5.0 * speed) / 100000;
						bonusT += bonus > 400 ? 400 : bonus;
					}
					ulStatus = ((speed * 8 * settings.overheadCompensationFactor) / (settings.useMebibits ? 1048576 : 1000000)).toFixed(2);
					if ((t + bonusT) / 1000.0 > settings.time_ul_max || failed) {
						if (failed || isNaN(ulStatus)) ulStatus = "Fail";
						clearRequests();
						clearInterval(interval);
						ulProgress = 1;
						done();
					}
				}
			}.bind(this),
			200
		);
	}.bind(this);
	testFunction();
}
let ptCalled = false;
function pingTest(done) {
	if (ptCalled) return;
	else ptCalled = true;
	const startT = new Date().getTime();
	let prevT = null;
	let ping = 0.0;
	let jitter = 0.0;
	let i = 0;
	let prevInstspd = 0;
	xhr = [];
	const doPing = function() {
		pingProgress = i / settings.count_ping;
		prevT = new Date().getTime();
		xhr[0] = new XMLHttpRequest();
		xhr[0].onload = function() {
			if (i === 0) {
				prevT = new Date().getTime();
			} else {
				let instspd = new Date().getTime() - prevT;
				if (settings.ping_allowPerformanceApi) {
					try {
						let p = performance.getEntries();
						p = p[p.length - 1];
						let d = p.responseStart - p.requestStart;
						if (d <= 0) d = p.duration;
						if (d > 0 && d < instspd) instspd = d;
					} catch (e) {
					}
				}
				if (instspd < 1) instspd = prevInstspd;
				if (instspd < 1) instspd = 1;
				const instjitter = Math.abs(instspd - prevInstspd);
				if (i === 1) ping = instspd;
				else {
					if (instspd < ping) ping = instspd;
					if (i === 2) jitter = instjitter;
					else jitter = instjitter > jitter ? jitter * 0.3 + instjitter * 0.7 : jitter * 0.8 + instjitter * 0.2;
				}
				prevInstspd = instspd;
			}
			pingStatus = ping.toFixed(2);
			jitterStatus = jitter.toFixed(2);
			i++;
			if (i < settings.count_ping) doPing();
			else {
				pingProgress = 1;
				done();
			}
		}.bind(this);
		xhr[0].onerror = function() {
			if (settings.xhr_ignoreErrors === 0) {
				pingStatus = "Fail";
				jitterStatus = "Fail";
				clearRequests();
				pingProgress = 1;
				done();
			}
			if (settings.xhr_ignoreErrors === 1) doPing();
			if (settings.xhr_ignoreErrors === 2) {
				i++;
				if (i < settings.count_ping) doPing();
				else {
					pingProgress = 1;
					done();
				}
			}
		}.bind(this);
		xhr[0].open("GET", settings.url_ping + url_sep(settings.url_ping) + "r=" + Math.random(), true);
		xhr[0].send();
	}.bind(this);
	doPing();
}
