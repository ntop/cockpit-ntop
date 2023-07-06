/*
 * Utility functions to manage tasks implementing a scheduler.
 *
 * Task status:
 * - pending
 * - running
 * - completed
 * - processed
 * - failed
 *
 */

/* Run a redis command */
async function redis() {
	let output = '';

	let command = ["redis-cli"];
	let args = Array.from(arguments);

	command = command.concat(args);

	await cockpit.spawn(command)
	.then(function (data) {
		output = data; 
	})
	.catch(function (exception) {
		console.log("Redis failure");
		console.log(exception);
	});

	return output.trim();
}

/* Generate a task ID from a sequence number */
async function createTaskID() {
	return await redis('INCR', 'nbox.tasks.ID');
}

/* Push a task ID to a redis queue to be processed */
async function pushTask(id) {
	/* Dequeue with redis-cli LPOP nbox.tasks.queue */
	await redis('RPUSH', 'nbox.tasks.queue', id);
}

/* Create a new task. A new task ID is returned.*/
export async function createTask(info) {
	/* Generate Task ID */
	let id = await createTaskID();

	/* Set Status */
	await redis('HSET', 'nbox.tasks:' + id, 'status', 'pending');

	/* Store Info (base64 encoded JSON) */
	await redis('HSET', 'nbox.tasks:' + id, 'info', btoa(JSON.stringify(info)));

	/* Enqueue */
	await pushTask(id);

	return id;
}

/* List all task IDs */
async function listTasks() {
	const data = await redis('KEYS', 'nbox.tasks:*');
	if (data.trim().length == 0) {
		return [];
	}
	const lines = data.split(/\r?\n/);
	let list = lines.map((line) => {
		const [prefix, ...value_arr] = line.split(':');
		const value = value_arr.join(':');
		return value.trim();
	});
	
	return list;
}

/* Get task status */
export async function getTaskStatus(id) {
	const status = await redis('HGET', 'nbox.tasks:' + id, 'status');
	if (status.length == 0)
		return 'unknown';
	return status;
}

/* Get task status */
export async function getTaskOutput(id) {
	const output = await redis('HGET', 'nbox.tasks:' + id, 'output');
	if (output.length == 0)
		return {};

	const json = atob(output);
	if (!json)
		return {};

	const data = JSON.parse(json);
	if (!data)
		return {};

	return data;
}

/* Set task status */
export async function setTaskStatus(id, status) {
	await redis('HSET', 'nbox.tasks:' + id, 'status', status);
}

/* Get task info */
export async function getTaskInfo(id) {
	const info = await redis('HGET', 'nbox.tasks:' + id, 'info');
	if (info.length == 0)
		return {};
	return JSON.parse(atob(info));
}

export async function getAllTasks() {
	const tasks = [];
	const list = await listTasks();
	for (const id of list) {
		const status = await getTaskStatus(id);
		const info = await getTaskInfo(id);
		const output = await getTaskOutput(id);
		tasks.push({
			id: id,
			status: status,
			info: info,
			output: output,
		});
	}
	return tasks;
}

/* Delete a task */
export async function deleteTask(id) {
	await redis('DEL', 'nbox.tasks:' + id);
}

