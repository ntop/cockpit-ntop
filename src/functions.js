
export function stubMode() {
	return false;
}

export function isValidInstanceName(str) {
	var pattern = new RegExp('^([a-z\\d-]*[a-z\\d])*$','i');
	return pattern.test(str);
}

export function isEndpoint(str) {
	var pattern = new RegExp('^((tcp|zmq|kafka):\\/\\/)?'+ // tcp:// or zmq:// or kafka://
		'((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|'+ // hostname
		'((\\d{1,3}\\.){3}\\d{1,3})|'+ // or IP (v4) address
		'(\\*))'+ // '*'
		'(\\:\\d+)?'+ // port
		'(c)?' + // 'c'
		'$','i');
	return pattern.test(str);
}

export function isIPPort(str) {
	var pattern = new RegExp('^((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|'+ // hostname
		'((\\d{1,3}\\.){3}\\d{1,3}))'+ // or IP (v4) address
		'(\\:\\d+)?'+ // port
		'$','i');
	return pattern.test(str);
}

export async function getNetworkInterfaces() {
	let json;

	var proc = await cockpit.spawn(["pfcount", "-I"])
	.then(function (data) { 
		json = JSON.parse(data);
	})
	.catch(function (exception) {
		console.log("Failure running pfcount");
		//console.log(exception);
	});

	if (json && json.interfaces)
		return json.interfaces;
	else
		return [];
}

export async function getApplicationVersion(name) {
	let info;

	var proc = await cockpit.spawn([name, "--version"])
	.then(function (data) { 
		const lines = data.split(/\r?\n/);
		info = lines.map((line) => {
			const [name, ...value_arr] = line.split(':');
			const value = value_arr.join(':');
			return {
				name: name.trim(),
				value: value.trim()
			};
		});
	})
	.catch(function (exception) {
		console.log("Failure running " + name + " --version");
		//console.log(exception);
	});

	if (info)
		return info;
	else
		return [];
}

export async function isServiceActive(name, instance) {
	let active = false;

	if (instance) {
		name = name + "@" + instance;
	}

	var proc = await cockpit.spawn(["systemctl", "is-active", name])
	.then(function (data) { 
		if (data && data.trim() == "active")
			active = true;
	})
	.catch(function (exception) {
		//console.log("isServiceActive exception");
		//console.log(exception);
	});

	return active;
}

export async function isServiceEnabled(name, instance) {
	let enabled = false;

	if (instance) {
		name = name + "@" + instance;
	}

	var proc = await cockpit.spawn(["systemctl", "is-enabled", name])
	.then(function (data) { 
		if (data && data.trim() == "enabled")
			enabled = true;
	})
	.catch(function (exception) {
		//console.log("isServiceEnabled exception");
		//console.log(exception);
	});

	return enabled;
}

export async function toggleService(name, enable, instance) {

	if (instance) {
		name = name + "@" + instance;
	}

	/* console.log("Setting " + name + " " + (enable?"on":"off")); */

	var proc1 = await cockpit.spawn(["systemctl", "-q", enable ? "enable" : "disable", name], {superuser:"require"})
	.then(function (data) { 
	})
	.catch(function (exception) {
		//console.log("toggleService exception (enable/disable)");
		//console.log(exception);
	});

	var proc2 = await cockpit.spawn(["systemctl", "-q", enable ? "restart" : "stop", name], {superuser:"require"})
	.then(function (data) { 
	})
	.catch(function (exception) {
		//console.log("toggleService exception (start/stop)");
		//console.log(exception);
	});
}

export async function restartService(name, instance) {

	if (instance) {
		name = name + "@" + instance;
	}

	var proc2 = await cockpit.spawn(["systemctl", "-q", "restart", name], {superuser:"require"})
	.then(function (data) { 
	})
	.catch(function (exception) {
		//console.log("restartService exception");
		//console.log(exception);
	});
}

export async function deleteService(name, instance) {
	toggleService(name, false, instance);
	await cockpit.spawn(["systemctl", "reset-failed"], {superuser:"require"});
}

export async function getLSBRelease() {
	const LSBReleaseFile = cockpit.file("/etc/lsb-release", { superuser: 'try' });
	const LSBRelease = await LSBReleaseFile.read();
	return LSBRelease;
}

export function parseConfiguration(content) {
	const lines = content.split(/\r?\n/);
	const params = lines.filter((line) => { 
		line = line.trim();
		return !(line.length == 0 || line.startsWith("#"));
	});
	const options = params.map((param) => {
		const [option, ...value_arr] = param.split('=');
		const value = value_arr.join('=');
		return {
			name: option,
			value: value
		};
	});

	return options;
}

export function serializeConfiguration(configuration) {
	let content = "";

	configuration.forEach(function (option) {
		if (option.name) {
			content += option.name;
			if (option.value)
				content += '=' + option.value;
			content += '\n';
		}
	});

	return content;
}

export async function fileExists(path) {
	let exists = false;

	var proc = await cockpit.spawn(["stat", path])
	.then(function () { 
		exists = true;
	})
	.catch(function (exception) {
	});

	return exists;
}

export async function readFile(path) {
	const file = cockpit.file(path, { superuser: 'try' });

	if (!file) {
		return "";
	}

	const content = await file.read();

	return content
}

export async function writeFile(path, content) {
	const file = cockpit.file(path, { superuser: 'try' });

	if (!file) {
		return;
	}

	await file.replace(content);
}

export async function readConfigurationFile(product, instance) {
	let configuration = [];

	const path = "/etc/" + product + "/" + product + (instance ? "-" + instance : "") + ".conf";

	const content = await readFile(path);

	if (content) {
		configuration = parseConfiguration(content);
	}

	return configuration;
}

export async function writeConfigurationFile(product, configuration, instance) {
	const path = "/etc/" + product + "/" + product + (instance ? "-" + instance : "") + ".conf";

	const content = serializeConfiguration(configuration);

	await writeFile(path, content);
}

export async function deleteConfigurationFile(product, instance) {
	const path = "/etc/" + product + "/" + product + (instance ? "-" + instance : "") + ".conf";
	await cockpit.spawn(["rm", path], {superuser:"require"})
}

export async function readMetadata(product, instance) {
	let configuration = {};

	const path = "/etc/" + product + "/" + product + (instance ? "-" + instance : "") + ".json";

	const content = await readFile(path);

	if (content) {
		configuration = JSON.parse(content);
	}

	if (!configuration) {
		configuration = {};
	}

	return configuration;
}

export async function writeMetadata(product, configuration, instance) {
	const path = "/etc/" + product + "/" + product + (instance ? "-" + instance : "") + ".json";

	if (!configuration) {
		configuration = {};
	}

	const content = JSON.stringify(configuration);

	await writeFile(path, content);
}

export async function deleteMetadata(product, instance) {
	const path = "/etc/" + product + "/" + product + (instance ? "-" + instance : "") + ".json";
	await cockpit.spawn(["rm", path], {superuser:"require"})
}

export async function getConfigurationFileList(product) {
	let instances = [];

	var proc = await cockpit.spawn(["ls", "/etc/" + product])
	.then(function (data) { 
		if (data) {
			const files = data.split(/\r?\n/);
			files.forEach(function(filename) {
				let match_arr = filename.match("^nprobe(.*)\\.conf$");
				if (match_arr && match_arr.length == 2) {
					let instance_name = match_arr[1];
					if (instance_name.startsWith('-')) {
						instance_name = instance_name.substring(1);
					}
					instances.push(instance_name);
				} else {
					//console.log("Not a conf: " + filename);
				}
			});
		}
	})
	.catch(function (exception) {
		console.log("Unable to list " + name + " instances");
		//console.log(exception);
	});

	return instances;
}

export async function getRRDData(application, instance, minutes) {
	let data = {};
	let systemd_instance = application;

	if (instance && instance.length > 0) {
		systemd_instance = application + "@" + instance;
	}

	const volume = "/storage";
	const dir = volume + "/rrd/" + application;
	const path = dir + "/" + systemd_instance + ".rrd";

	const cmd = [];
	cmd.push("rrdtool");
	cmd.push("fetch");
	cmd.push(path);
	cmd.push("AVERAGE");
	cmd.push("-s");
	cmd.push("-" + minutes + "min");

	var proc = await cockpit.spawn(cmd, {superuser:"try"})
	.then(function (output) { 
		const lines = output.trim().split(/\r?\n/);

		const names = lines.shift().split(' ').filter(name => name.length > 0);

		const empty = lines.shift();

		for (const line of lines) {
			const columns = line.split(' ');
			const epoch = parseInt(columns[0].split(':')[0]);
			let index = 1;
			for (const name of names) {
				if (!data[name])
					data[name] = [];

				if (columns[index] != '-nan') {
					const value = parseFloat(columns[index]);
					data[name].push({
						x: epoch*1000,
						y: value
					});
				}
				index++;
			}
		}
	})
	.catch(function (exception) {
		//console.log("Failure reading RRD " + path);
		//console.log(exception);
	});
	
	return data;
}

