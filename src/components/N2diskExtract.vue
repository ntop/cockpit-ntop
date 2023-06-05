
<template>

<div class="configuration">

<!-- Scheduled Tasks Table -->
<div class="card w-100">
	<div class="card-header">
		<div class="card-title">
			<h3>Extractions <font-awesome-icon icon="fa-solid fa-magnifying-glass" /></h3>
		</div>
		<div class="service-switch">
			<a class="nav-link" href="#" @click="createTaskModal.show()"><h3><font-awesome-icon icon="fa-solid fa-plus" class="" title="Add Task" /></h3></a>
		</div>
	</div>

	<div class="card-body">
		<DataTable :data="tasksTableData" :columns="tasksTableColumns" :options="tasksTableOptions" class="table table-hover table-striped" width="100%">
			<thead>
				<tr>
					<th>ID</th>
					<th>Status</th>
					<th>Creation Date</th>
					<th>From Date</th>
					<th>To Date</th>
					<th>Filter</th>
					<th></th>
				</tr>
			</thead>
		</DataTable>
	</div>
</div>

<!-- Datatable icons -->
<div class="d-none" id="icon-pending"   ><font-awesome-icon icon="fa-solid fa-hourglass-start"      class="text-secondary" /></div>
<div class="d-none" id="icon-running"   ><font-awesome-icon icon="fa-solid fa-spinner"              class="rotate"         /></div>
<div class="d-none" id="icon-completed" ><font-awesome-icon icon="fa-solid fa-circle-check"         class="text-success"   /></div>
<div class="d-none" id="icon-failed"    ><font-awesome-icon icon="fa-solid fa-triangle-exclamation" class="text-success"   /></div>
<div class="d-none" id="icon-processed" ><font-awesome-icon icon="fa-solid fa-user-check"           class="text-primary"   /></div>
<div class="d-none" id="icon-delete"    ><font-awesome-icon icon="fa-solid fa-trash"                class="text-secondary" /></div>
<div class="d-none" id="icon-folder"    ><font-awesome-icon icon="fa-solid fa-folder-open"          class="text-secondary" /></div>
<div class="d-none" id="icon-logs"      ><font-awesome-icon icon="fa-solid fa-scroll"               class="text-secondary" /></div>

<!--  New Task Modal -->
<Modal ref="createTaskModal">
	<template v-slot:title>
		Schedule Extraction
	</template>
	<template v-slot:body>
		<div class="form-group">
			<h5>Time Interval</h5>
			<Datepicker v-model="timeInterval" model-type="timestamp" range enable-seconds format="dd/MM/yyyy HH:mm:ss" :clearable="false" required :class="{ 'border border-danger': invalidTimeInterval }" @change="onConfigChange()" @update:modelValue="onConfigChange" />
			<small class="form-text text-muted">Time interval for traffic extraction from the dump set.</small>
		</div>

		<div class="form-group">
			<h5>Source Storage</h5>
			<Multiselect v-model="selectedTimelines" :options="timelinesList" mode="tags" :preselect-first="false" placeholder="Select the source timeline folders" :close-on-select="false" ref="timelineMultiselect" :class="{ 'border border-danger': invalidTimelines }" @change="onConfigChange()" @select="onConfigChange()" />
			<small class="form-text text-muted">Source timeline folders from which packets are extracted.</small>
		</div>

		<div class="form-group">
			<h5>Filter</h5>
			<input type="text" class="form-control" :class="{ 'border border-danger': invalidFilter }" ref="bpfFilter" placeholder="e.g. host 192.168.1.1" @change="onConfigChange()" />
			<small class="form-text text-muted"><a href="https://www.ntop.org/guides/n2disk/filters.html" class="description-link" target="_blank">BPF-like filter</a> for selecting packets to be extracted.</small>
		</div>

		<div class="form-group">
			<h5>Output Folder</h5>
			<input type="text" class="form-control" :class="{ 'border border-danger': invalidStoragePath }" ref="storagePath" placeholder="e.g. /storage" @change="onConfigChange()" />
			<small class="form-text text-muted">Folder where extracted PCAP files are stored.</small>
		</div>

		<div class="form-group">
			<h5>Max File Size</h5>
			<Slider v-model="fileSize" :format="formatSize" :min="minFileSize" :max="maxFileSize" :step="stepFileSize" ref="fileSizeSlider" @change="onConfigChange()" />
			<small class="form-text text-muted">Maximum size for produced PCAP files.</small>
		</div>

	</template>
	<template v-slot:footer>
		<button class="btn btn-primary" @click="addTask()" :disabled="!validationOk">Schedule</button>
		<button class="btn btn-secondary" @click="createTaskModal.close()">Close</button>
	</template>
</Modal>

<Modal ref="onDeleteModal">
	<template v-slot:title>
		Delete Extraction {{ currentTaskID }}
	</template>
	<template v-slot:body>
		Are you sure you want to delete this extraction?
	</template>
	<template v-slot:footer>
		<button class="btn btn-primary" @click="delTask()">Confirm</button>
		<button class="btn btn-secondary" @click="onDeleteModal.close()">Close</button>
	</template>
</Modal>

</div><!-- configuration -->

</template>

<script setup>
import { ref, onMounted, onBeforeMount, computed, watch } from "vue";
import { stubMode, isEndpoint, isIPPort, readConfigurationFile, parseConfiguration, writeConfigurationFile, isValidPath, isValidFilter, createPath, getConfigurationFileList } from "../functions";
import { createTask, getAllTasks, deleteTask, getTaskInfo, getTaskStatus, setTaskStatus } from "../tasks.js"
import Multiselect from '@vueform/multiselect'
import Slider from '@vueform/slider'
import Toggle from '@vueform/toggle'
import Modal from './Modal.vue'
import TagInput from "./TagInput.vue";
import Datepicker from '@vuepic/vue-datepicker';
import DataTable from 'datatables.net-vue3'
import DataTablesLib from 'datatables.net';
import moment from "moment";
import { useToast } from "vue-toastification";
import '@vuepic/vue-datepicker/dist/main.css';

const toast = useToast();

DataTable.use(DataTablesLib);

/* 
 * Component parameters
 * Types: String, Object, Number, Boolean, Array
 * Print with console.logs(props.name);
 */
const props = defineProps({
})

/* Scheduled Tasks Table */
const tasksTableData = ref([]);

const currentTaskID = ref("0");

const tasksTableOptions = ref({
	searching: false,
	paging: false,
	autoWidth: false,
	order: [[0, 'desc']],
	language: {
		emptyTable: "No extractions scheduled"
	}
});

function getIcon(name) {
	const elem = document.getElementById("icon-" + name);
	if (!elem) return '';
	return elem.innerHTML;
}

const tasksTableColumns = ref([
	{
		data: 'id',
	},
	{
		data: 'status',
		render: function (data, type) {
			if (type === 'display') {
				let icon = getIcon(data);
				let label = data.charAt(0).toUpperCase() + data.slice(1);
				return icon + ' ' + label;
			}
			return data;
		},
	},
	{
		data: 'creation',
		render: function (data, type) {
			if (type === 'display') {
				return moment.unix(data).format('DD/MM/YYYY HH:mm:ss');
			}
			return data;
		},
	},
	{
		data: 'from_time',
		render: function (data, type) {
			if (type === 'display') {
				return moment.unix(data).format('DD/MM/YYYY HH:mm:ss');
			}
			return data;
		},
	},
	{
		data: 'to_time',
		render: function (data, type) {
			if (type === 'display') {
				return moment.unix(data).format('DD/MM/YYYY HH:mm:ss');
			}
			return data;
		},
	},
	{
		data: 'info',
	},
	{
		data: 'actions',
		orderable: false,
		render: function (data, type, row) {
			if (type === 'display') {
				let actions = "";
				actions += "<a href='#' id='task_delete_" + row.id + "'>" + getIcon("delete") + "</a> ";
				if (row.status == 'completed' || row.status == 'processed') {
					actions += "<a href='#' id='task_folder_" + row.id + "'>" + getIcon("folder") + "</a> ";
				}
				actions += data;
				return actions;
			}
			return data;
		},
	}
]);

/* New Task Modal */

const createTaskModal = ref(null)

const initialTimeInterval = [
	Date.now() - (5*60*1000),
	Date.now()
];

/* Empty configuration */
const fileSize = ref(64);
const minFileSize = ref(64);
const maxFileSize = ref(4096);
const stepFileSize = ref(64);
const selectedTimelines = ref([]);

/* Form data */
const timeInterval = ref(initialTimeInterval);
const timelineMultiselect = ref(null);
const fileSizeSlider = ref(null);
const storagePath = ref(null)
const bpfFilter = ref(null)
const configChanged = ref(false)
const onApplyModal = ref(null)
const onDeleteModal = ref(null)

const validationOk = ref(true);
const invalidTimelines = ref(false)
const invalidStoragePath = ref(false)
const invalidFilter = ref(false)
const invalidTimeInterval = ref(false);

/* Data */
const timelinesList = ref([]);

function formatSize(value) {
	if (value >= 1024)
		return (Math.round((value/1024)*100)/100) + " GB";
	else
		return Math.round(value) + " MB";
}

/* Convert task information into datatable format */
function taskInfoToTableData(id, status, info) {
	return {
		id: id,
		status: status,
		creation: info.creation_time,
		from_time: info.from_time,
		to_time: info.to_time,
		info: info.filter,
		folder: info.folder,
		actions: ""
	};
}

/* Add a new task to the scheduler */
async function addTask() {
	onConfigChange({}, true);

	if (!validationOk.value)
		return;

	createTaskModal.value.close();

	await createPath(storagePath.value.value /* path */, "n2disk" /* user */)

	const task_info = {
		creation_time: Date.now()/1000,
		timelines: selectedTimelines.value,
		from_time: timeInterval.value[0]/1000,
		to_time: timeInterval.value[1]/1000,
		filter: bpfFilter.value.value,
		folder: storagePath.value.value,
		max_file_size: fileSize.value
	};
	const id = await createTask(task_info);

	await updateTasks(); /* tasksTableData.value.unshift(taskInfoToTableData(id, "pending", task_info)); */

	toast.success("Extraction scheduled!");
}

/* Add action links to the table when after data is rendered */
watch([tasksTableData], (cur_value, old_value) => {
	tasksTableData.value.forEach(function (task) {
		const id = task.id;
		const status = task.status;
		const folder = task.folder;

		/* On delete action */
		let delete_link = document.getElementById("task_delete_" + id);
		delete_link.onclick = function () {
			currentTaskID.value = id;
			onDeleteModal.value.show();
		}

		/* On folder open action */
		if (task.status == 'completed' || task.status == 'processed') {
			let folder_link = document.getElementById("task_folder_" + id);
			folder_link.onclick = async function () {
				if (status == 'completed') {
					await setTaskStatus(id, 'processed');
				}

				/* Redirect to the right folder in the file Navigator */
				window.open("/navigator#" + folder, "_blank");
			}
		}
	});
}, { flush: 'post'});

/* Delete a task (TODO: optionally delete also PCAP files) */
async function delTask() {
	await deleteTask(currentTaskID.value);
	await updateTasks();
	onDeleteModal.value.close();
}

/* Update the tasks table */
async function updateTasks() {
	const tasks = await getAllTasks(); 

	const tasks_data = tasks.map((task) => {
		return taskInfoToTableData(task.id, task.status, task.info);
	});

	tasksTableData.value = tasks_data;
}

/* Get all timelines configured in the n2disk configuration files */
async function getTimelines() {
	let timeline_paths = [];

	const names = await getConfigurationFileList("n2disk");
	names.sort();
	for (const name of names) {
		const configuration = await readConfigurationFile("n2disk", name);
		configuration.forEach(function (option) {
			switch (option.name) {
				case '-A':
				case '--timeline-dir':
					timeline_paths.push(option.value);
					break;
			}
		});
	}

	return timeline_paths;
}

/* Before mount: initialize configuration */
onBeforeMount(async () => {
	let timeline_paths = []

	/* Read timelines */
	if (stubMode()) {
		timeline_paths = ['/storage/n2disk/eno1', '/storage/n2disk/eno2'];
	} else {
		timeline_paths = await getTimelines();
	}

	timelinesList.value = timeline_paths
});

function onConfigChange(e, checkEmpty) {
	/* Reset */
	invalidTimelines.value = false;
	invalidStoragePath.value = false;
	invalidFilter.value = false;
	invalidTimeInterval.value = false;

	/* Validate */
	const interval = timeInterval.value;
	if (interval.length != 2 ||
		!interval[0] ||
		!interval[1]) {
		invalidTimeInterval.value = true;
	}

	const timelinePaths = selectedTimelines.value;
	if (checkEmpty && timelinePaths.length < 1) {
		invalidTimelines.value = true;
	}

	if (timelinePaths.length >= 1 && !storagePath.value.value) {
		storagePath.value.value = timelinePaths[0];
	}

	const path = storagePath.value.value;
	if ((checkEmpty && !path) || (path && !isValidPath(path))) {
		invalidStoragePath.value = true;
	}

	const filter = bpfFilter.value.value;
	if (filter && !isValidFilter) {
		invalidFilter.value = true;
	}

	/* Update global validation flag */
	validationOk.value =
		!invalidStoragePath.value &&
		!invalidFilter.value &&
		!invalidTimeInterval.value &&
		!invalidTimelines.value;

	/* Set config changed */
	configChanged.value = true;
}

/* On mount: load configuration from file */
onMounted(async () => {
	if (stubMode()) {
		tasksTableData.value = [
			{
				id: "1",
				status: "processed",
				creation: 1634914155,
				from_time: 1634914140,
				to_time: 1634914145,
				info: "BPF = \"ip host 192.168.1.195 and ip host 192.168.1.97 and port 443\"",
				actions: ""
			},
			{
				id: "2",
				status: "completed",
				creation: 1634914156,
				from_time: 1634914141,
				to_time: 1634914146,
				info: "BPF = \"ip host 192.168.1.195 and ip host 192.168.1.97 and port 443\"",
				actions: ""
			},
			{
				id: "3",
				status: "running",
				creation: 1634914157,
				from_time: 1634914142,
				to_time: 1634914147,
				info: "BPF = \"ip host 192.168.1.195\"",
				actions: ""
			},
			{
				id: "4",
				status: "pending",
				creation: 1634914158,
				from_time: 1634914144,
				to_time: 1634914148,
				info: "BPF = \"ip host 192.168.1.1\"",
				actions: ""
			},
		];
	} else {
		updateTasks();
		setInterval(() => {
			updateTasks();
		}, 5000)
	}
});

</script>

<style src="@vueform/multiselect/themes/default.css"></style>
<style src="@vueform/toggle/themes/default.css"></style>
<style src="@vueform/slider/themes/default.css"></style>
<style>
@import 'datatables.net-bs5';
</style>
