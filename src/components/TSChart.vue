<template>
	<apexchart type="area" :options="chartOptions" :series="series"></apexchart>
</template>

<script setup>
import { ref, watch, nextTick, onMounted, computed } from "vue";

const props = defineProps({
	name: {
		type: String,
		required: true
	},
	series: {
		type: Object,
		required: true
	},
	unit: {
		type: String, /* bps, pps */
		required: false
	}
})

const types = {
	bps: {
		id: "bps",
		um: ["bps", "Kbps", "Mbps", "Gbps", "Tbps"],
		step: 1000,
		decimal: 2,
		scale_values: 8,
	},
	fps: {
		id: "fps",
		um: ["flows/s", "Kflows/s", "Mflows/s", "Gflows/s"],
		step: 1000,
		decimal: 2,
		scale_values: null,
	},
	pps: {
		id: "pps",
		um: ["pps", "Kpps", "Mpps", "Gpps", "Tpps"],
		step: 1000,
		decimal: 2,
		scale_values: null,
	},
}

function getFormatter(type) {
	let typeOptions = types[type];
	let maxLenValue = 6; // 000.00
	let maxLenUm = 8; // Mflows/s
	let formatter = function(value) {
		if (value == null) {
			return '';
		}
		if (!typeOptions) {
			return value;
		}
		if (typeOptions.scale_values != null) {
			value *= typeOptions.scale_values;
		}
		let negativeValue = value < 0;
		if (negativeValue) { value *= -1; }

		let step = typeOptions.step;
		let decimal = typeOptions.decimal;
		let measures = typeOptions.um;
		let i = 0;
		if (typeOptions.max_value != null && value > typeOptions.max_value) {
			value = typeOptions.max_value
		}

		while (value >= step && i < measures.length) {
			value = value / step;
			i += 1;
		}

		if (decimal != null && decimal > 0) {
			value = value * Math.pow(10, decimal);
			value = Math.round(value);
			value = value / Math.pow(10, decimal);
			value = value.toFixed(decimal);
		} else {
			value = Math.round(value);
		}

		if (negativeValue) { value *= -1; }
		let valString = `${value}`;
		let mString = `${measures[i]}`;
		let text = `${valString} ${mString}`;
		return text;
	}
	return formatter;
}

const chartOptions = ref({
	chart: {
		stacked: true,
		zoom: {
			enabled: false,
			autoScaleYaxis: true
		},
		toolbar: {
			show: false
		}
	},
	title: {
		text: props.name,
		margin: 0,
		offsetX: 75,
		offsetY: 5,
		floating: true,
		style: {
			fontWeight:  'lighter',
		}
	},
	xaxis: {
		type: 'datetime',
		tickAmount: 6,
		labels: {
			datetimeUTC: false
		}
	},
	yaxis: {
		labels: {
			formatter: getFormatter(props.unit)
		}
	},
	tooltip: {
		enabled: false,
		x: {
			show: false,
			format: 'dd MMM yyyy hh:mm:ss'
		}
	},
	markers: {
		size: 0,
		style: 'hollow'
	},
	dataLabels: {
		enabled: false
	},
	stroke: {
		curve: 'straight',
		width: 0,
	},
	fill: {
		type: 'solid',
		opacity: 1,
	}
})

</script>

