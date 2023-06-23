<template>
	<Ntopng v-if="product == 'ntopng'" />
	<Nprobe v-if="product == 'nprobe'" />
	<N2disk v-if="product == 'n2disk'" />
	<Cento  v-if="product == 'cento'" />
	<Cluster v-if="product == 'cluster'" />
	<Preferences v-if="product == 'preferences'" />
</template>

<style scoped>
</style>

<script setup>
import { ref, onMounted, onBeforeMount, computed, watch } from "vue";
import Ntopng from './components/Ntopng.vue'
import Nprobe from './components/Nprobe.vue'
import N2disk from './components/N2disk.vue'
import Cento  from './components/Cento.vue'
import Cluster  from './components/Cluster.vue'
import Preferences  from './components/Preferences.vue'
import { stubMode, testComponent } from "./functions";

const product = ref('')

onBeforeMount(async () => {
	let pathname = window.location.pathname;

	if (pathname.includes('/ntopng/'))
		product.value = 'ntopng';
	else if (pathname.includes('/nprobe/'))
		product.value = 'nprobe';
	else if (pathname.includes('/n2disk/'))
		product.value = 'n2disk';
	else if (pathname.includes('/cento/'))
		product.value = 'cento';
	else if (pathname.includes('/cluster/'))
		product.value = 'cluster';
	else if (pathname.includes('/nbox-preferences/'))
		product.value = 'preferences';
	else
		product.value = testComponent();
});

</script>

