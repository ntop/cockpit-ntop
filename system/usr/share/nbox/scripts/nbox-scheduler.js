/*
 * nBox UI - Deferred Tasks Scheduler (e.g. traffic extractions)
 * 2022-23 © ntop
 */

const { promisify } = require('util');
const exec = promisify(require('child_process').exec)
const fs = require('fs')

function pad2(n) {
	return ("0" + n).slice(-2);
}

function format_epoch(timestamp) {
	const date = new Date(timestamp*1000);
	const year = date.getFullYear();
	const month = date.getMonth() + 1;
	const day = date.getDate();
	const hours = date.getHours();
	const minutes = date.getMinutes();
	const seconds = date.getSeconds();
	return year + "-" + pad2(month) + "-" + pad2(day) + " " + pad2(hours) + ":" + pad2(minutes) + ":" + pad2(seconds);
}

/* Run a redis command */
async function redis() {
	let command = ["redis-cli"];
	let args = Array.from(arguments);
	command = command.concat(args);
	const output = await exec(command.join(' '));
	return output.stdout.trim();
}

/* Get next task from queue */
async function get_next_task_id() {
	return await redis('LPOP', 'nbox.tasks.queue');
}

/* Get task status */
async function get_task_status(id) {
	const status = await redis('HGET', 'nbox.tasks:' + id, 'status');
	if (status.length == 0)
		return 'unknown';
	return status;
}

/* Set task status */
async function set_task_status(id, status) {
	await redis('HSET', 'nbox.tasks:' + id, 'status', status);
}

/* Get task info */
async function get_task_info(id) {
	const info = await redis('HGET', 'nbox.tasks:' + id, 'info');
	if (info.length == 0)
		return {};

	//let json = atob(info);
	let json = Buffer.from(info, 'base64').toString();

	return JSON.parse(json);
}

async function dequeue_tasks() {
	let task_id = await get_next_task_id();

	while (task_id) {
		console.log("Processing task #" + task_id);

		const status = await get_task_status(task_id);
		const info = await get_task_info(task_id);	

		let new_status = 'failed';
		if (status && status != 'unknown' && info &&
		    info.timelines && info.timelines.length > 0 &&
		    info.from_time &&
		    info.to_time &&
		    info.folder) {

			await set_task_status(task_id, 'running');

			let command = ["npcapextract"];

			for (const timeline of info.timelines) {
				command.push('-t');
				command.push(timeline);
			}
			
			command.push('-b');
			command.push('"' + format_epoch(info.from_time) + '"');

			command.push('-e');
			command.push('"' + format_epoch(info.to_time) + '"');

			command.push('-o');
			command.push(info.folder);

			command.push('-x'); /* file prefix */
			command.push('extraction_' + task_id + '_');

			if (info.max_file_size) {
				command.push('-P');
				command.push(info.max_file_size);
			}

			if (info.filter) {
				command.push('-f');
				command.push('"' + info.filter + '"');
			}

			let cmd = command.join(' ');

			console.log("Running " + cmd);

			const output = await exec(cmd);

			new_status = 'completed';
		}

		await set_task_status(task_id, new_status);

		task_id = await get_next_task_id();
	}

	setTimeout(dequeue_tasks, 1000);
}

setTimeout(dequeue_tasks, 1000);
