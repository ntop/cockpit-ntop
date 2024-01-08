/*
 * nBox UI - JS Tool for dumping RRDs
 * 2022-23 © ntop
 */

const { promisify } = require('util');
const exec = promisify(require('child_process').exec)
const fs = require('fs')

const debug = false;

async function get_running_services(application) {
	const cmd = "systemctl list-units  --type=service  --state=running | grep " + application + " | tr -d ' ' | cut -d '.' -f 1";
	if (debug) {
		console.log(cmd);
	}
	const output = await exec(cmd);
	return output.stdout.trim().split(/\r?\n/);
}

async function get_service_pid(instance) {
	const cmd = "systemctl show -p MainPID " + instance + " 2>/dev/null | cut -d= -f2";
	if (debug) {
		console.log(cmd);
	}
	const output = await exec(cmd);
	return output.stdout.trim();
}

async function get_service_stats(pid) {
	let stats = [];
	const cmd = "cat /proc/net/pf_ring/stats/" + pid + "-*";
	try {
		const output = await exec(cmd);
		if (output.stdout) {
			const lines = output.stdout.trim().split(/\r?\n/);
			stats = lines.map(info => {
				const pair = info.split(/:(.*)/s);
				return {
					name: pair[0].trim(),
					value: pair[1].trim()
				} 
			});
		}
	} catch (error) {
		if (debug) {
			console.error(error);
		}
	}
	return stats
}

async function update_rrd(application, instance, metrics, stats) {
	const volume = "/storage";
	const dir = volume + "/rrd/" + application;
	const path = dir + "/" + instance + ".rrd";

	let cmd = "mkdir -p " + dir;
	let output = await exec(cmd);

	if (!fs.existsSync(path)) {
		cmd = "rrdtool create --step 10 " + path + " ";
		for (const metric of metrics) {
			cmd += "DS:" + metric + ":DERIVE:30:0:U ";
		}
		cmd += "RRA:AVERAGE:0.5:1:180 ";
		cmd += "RRA:AVERAGE:0.5:30:600";

		if (debug) {
			console.log(cmd);
		} else {
			output = await exec(cmd);
		}
	}

	cmd = "rrdtool update " + path + " N";
	for (const metric of metrics) {
		cmd += ":" + stats[metric];
	}

	if (debug) {
		console.log(cmd);
	} else {
		output = await exec(cmd);
	}
}

async function dump_nprobe_stats() {
	const application = "nprobe";
	const metrics = ['receivedPkts', 'filteredPkts', 'droppedPkts', 'receivedBytes', 'exportedFlows'];

	const instances = await get_running_services(application);
	for (const instance of instances) {
		const pid = await get_service_pid(instance);

		if (debug) {
			console.log("--- Instance " + instance  + " has PID = " + pid);
		}

		const service_stats = await get_service_stats(pid);

		if (service_stats.length == 0) {
			console.log("Failure reading stats for " + application + " on " + instance  + " with PID = " + pid);
		} else {
			let stats = [];
			service_stats.forEach(function(item) {
				if (debug) {
					console.log(item.name + " => " + item.value);
				}
				switch (item.name) {
					case 'Packets':
						const packets_info = item.value.split(' ')[0].split('/');
						stats['receivedPkts'] = packets_info[0];
						stats['filteredPkts'] = packets_info[0];
						stats['droppedPkts'] = packets_info[1];
						break;
					case 'Bytes':
						stats['receivedBytes'] = item.value; 
						break;
					case 'FlowExportStats':
						const flow_info = item.value.split(' ')[0].split('/');
						stats['exportedFlows'] = flow_info[2]; 
						break;
				}
			})

			update_rrd(application, instance, metrics, stats);
		}
	}
}

async function dump_cento_stats() {
	const application = "cento";
	const metrics = ['receivedPkts', 'filteredPkts', 'droppedPkts', 'receivedBytes', 'activeFlows', 'exportedFlows'];

	const instances = await get_running_services(application);
	for (const instance of instances) {
		const pid = await get_service_pid(instance);

		if (debug) {
			console.log("--- Instance " + instance  + " has PID = " + pid);
		}

		const service_stats = await get_service_stats(pid);

		if (service_stats.length == 0) {
			console.log("Failure reading stats for " + application + " on " + instance  + " with PID = " + pid);
		} else {
			let stats = [];
			service_stats.forEach(function(item) {
				if (debug) {
					console.log(item.name + " => " + item.value);
				}
				switch (item.name) {
					case 'Packets':
						stats['receivedPkts'] = item.value;
						stats['filteredPkts'] = item.value;
					case 'Dropped':
						stats['droppedPkts'] = item.value;
						break;
					case 'Bytes':
						stats['receivedBytes'] = item.value; 
						break;
					case 'Flows':
						const flow_info = item.value.replaceAll("'", "").split(' ')[0].split('/');
						stats['activeFlows'] = flow_info[0]; 
						stats['exportedFlows'] = flow_info[1]; 
						break;
				}
			})
	
			update_rrd(application, instance, metrics, stats);
		}
	}
}

async function dump_n2disk_stats() {
	const application = "n2disk";
	const metrics = ['receivedPkts', 'filteredPkts', 'droppedPkts', 'receivedBytes', 'dumpedBytes'];

	const instances = await get_running_services(application);
	for (const instance of instances) {
		const pid = await get_service_pid(instance);

		if (debug) {
			console.log("--- Instance " + instance  + " has PID = " + pid);
		}

		const service_stats = await get_service_stats(pid);

		if (service_stats.length == 0) {
			console.log("Failure reading stats for " + application + " on " + instance  + " with PID = " + pid);
		} else {
			let stats = [];
			service_stats.forEach(function(item) {
				if (debug) {
					console.log(item.name + " => " + item.value);
				}
				switch (item.name) {
					case 'Packets':
						stats['receivedPkts'] = item.value;
						break;
					case 'Filtered':
						stats['filteredPkts'] = item.value;
						break;
					case 'Dropped':
						stats['droppedPkts'] = item.value;
						break;
					case 'Bytes':
						stats['receivedBytes'] = item.value; 
						break;
					case 'DumpedBytes':
						stats['dumpedBytes'] = item.value;
						break;
				}
			})

			update_rrd(application, instance, metrics, stats);
		}
	}
}

async function dump_cluster_stats() {
	const application = "cluster";
	const metrics = ['receivedPkts', 'filteredPkts', 'forwardedPkts', 'processedPkts', 'droppedPkts' ];

	const instances = await get_running_services(application);
	for (const instance of instances) {
		const pid = await get_service_pid(instance);

		if (debug) {
			console.log("--- Instance " + instance  + " has PID = " + pid);
		}

		const service_stats = await get_service_stats(pid);

		if (service_stats.length == 0) {
			console.log("Failure reading stats for " + application + " on " + instance  + " with PID = " + pid);
		} else {
			let stats = [];
			stats['droppedPkts'] = 0;
			service_stats.forEach(function(item) {
				if (debug) {
					console.log(item.name + " => " + item.value);
				}
				switch (item.name) {
					case 'Packets':
						stats['receivedPkts'] = item.value;
						stats['filteredPkts'] = item.value;
						break;
					case 'Forwarded':
						stats['forwardedPkts'] = item.value;
						break;
					case 'Processed':
						stats['processedPkts'] = item.value;
						break;
					case 'IFDropped':
						/* May be set or not depending on conf */
						stats['droppedPkts'] = item.value;
						break;
				}
			})

			update_rrd(application, instance, metrics, stats);
		}
	}
}

setInterval(dump_nprobe_stats, 5000);
setInterval(dump_cento_stats,  5000);
setInterval(dump_n2disk_stats, 5000);
setInterval(dump_cluster_stats, 5000);
